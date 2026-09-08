from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin, urlparse
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup
from sqlalchemy.dialects.postgresql import insert

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.event import ScrapedEvent
SOURCE_CATEGORIES = {
    "developer": ("developer", "software", "engineering", "dev", "programmer"),
    "open_source": ("open source", "open-source", "opensource", "github"),
    "ai": ("ai", "artificial intelligence", "machine learning", "llm", "ml"),
    "web3": ("web3", "blockchain", "crypto", "defi", "nft"),
}

DEFAULT_HTTP_HEADERS = {"User-Agent": "See/1.0 (+https://example.invalid)"}


def _split_env_list(raw: str) -> list[str]:
    return [item.strip() for item in re.split(r"[\n,;]+", raw) if item.strip()]


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def _dedupe_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value and value not in seen:
            seen.add(value)
            result.append(value)
    return result


def _slug_from_url(url: str) -> str:
    parsed = urlparse(url)
    slug = parsed.path.rstrip("/").rsplit("/", 1)[-1]
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", slug).strip("-")
    if slug:
        return slug.lower()
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]


def _fetch_url(url: str) -> tuple[str, str]:
    request = Request(url, headers=DEFAULT_HTTP_HEADERS)
    with urlopen(request, timeout=30) as response:  # nosec: B310
        charset = response.headers.get_content_charset() or "utf-8"
        content_type = response.headers.get_content_type()
        body = response.read().decode(charset, errors="replace")
    return content_type, body


def _parse_isoish(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    text = _clean_text(value)
    if not text:
        return None
    candidate = text.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(candidate)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        pass
    for fmt in ("%Y%m%dT%H%M%S", "%Y%m%dT%H%M", "%Y%m%d"):
        try:
            parsed = datetime.strptime(text, fmt)
            return parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _parse_flexible_text_datetime(text: Any) -> datetime | None:
    cleaned = _clean_text(text)
    if not cleaned:
        return None

    iso_candidate = _parse_isoish(cleaned)
    if iso_candidate is not None:
        return iso_candidate

    patterns = [
        "%b %d, %Y",
        "%B %d, %Y",
        "%b %d %Y",
        "%B %d %Y",
        "%b %d",
        "%B %d",
    ]
    for pattern in patterns:
        try:
            parsed = datetime.strptime(cleaned, pattern)
            if "%Y" not in pattern:
                parsed = parsed.replace(year=datetime.now(timezone.utc).year)
            return parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            continue

    match = re.search(
        r"(?P<month>[A-Za-z]{3,9})\s+(?P<day>\d{1,2})(?:,\s*(?P<year>\d{4}))?",
        cleaned,
    )
    if match:
        month = match.group("month")
        day = int(match.group("day"))
        year = int(match.group("year") or datetime.now(timezone.utc).year)
        for fmt in ("%b", "%B"):
            try:
                month_number = datetime.strptime(month, fmt).month
                return datetime(year, month_number, day, tzinfo=timezone.utc)
            except ValueError:
                continue
    return None


def _parse_categories(*values: Any) -> list[str]:
    haystack = " ".join(_clean_text(value).lower() for value in values if _clean_text(value))
    categories: list[str] = []
    for slug, keywords in SOURCE_CATEGORIES.items():
        if any(keyword in haystack for keyword in keywords):
            categories.append(slug)
    return _dedupe_preserve_order(categories)


def _normalize_category_values(raw: Any) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        values = [_clean_text(item).lower().replace(" ", "_") for item in raw if _clean_text(item)]
        return _dedupe_preserve_order([value for value in values if value])
    if isinstance(raw, str):
        values = [part.strip().lower().replace(" ", "_") for part in re.split(r"[,/|]+", raw) if part.strip()]
        return _dedupe_preserve_order(values)
    return [_clean_text(raw).lower().replace(" ", "_")]


def _infer_is_virtual(location: Any, explicit: Any = None) -> bool:
    if isinstance(explicit, bool):
        return explicit
    location_text = _clean_text(location).lower()
    if not location_text:
        return True
    return any(keyword in location_text for keyword in ("online", "virtual", "remote", "zoom", "meet"))


def _parse_ics_value(raw_value: str, params: dict[str, str]) -> datetime | None:
    value = _clean_text(raw_value).replace("\\n", "\n")
    tzid = params.get("TZID")

    if not value:
        return None

    if re.fullmatch(r"\d{8}", value):
        return datetime.strptime(value, "%Y%m%d").replace(tzinfo=timezone.utc)

    if re.fullmatch(r"\d{8}T\d{6}Z", value):
        return datetime.strptime(value, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)

    if re.fullmatch(r"\d{8}T\d{6}", value):
        parsed = datetime.strptime(value, "%Y%m%dT%H%M%S")
        if tzid:
            try:
                return parsed.replace(tzinfo=ZoneInfo(tzid)).astimezone(timezone.utc)
            except Exception:
                pass
        return parsed.replace(tzinfo=timezone.utc)

    parsed = _parse_isoish(value)
    if parsed is not None:
        if tzid and parsed.tzinfo is None:
            try:
                return parsed.replace(tzinfo=ZoneInfo(tzid)).astimezone(timezone.utc)
            except Exception:
                return parsed.replace(tzinfo=timezone.utc)
        return parsed
    return None


def _parse_ics_events(ics_text: str, feed_url: str) -> list[dict[str, Any]]:
    normalized = ics_text.replace("\r\n", "\n").replace("\r", "\n")
    unfolded: list[str] = []
    for line in normalized.split("\n"):
        if line.startswith((" ", "\t")) and unfolded:
            unfolded[-1] += line[1:]
        else:
            unfolded.append(line)

    events: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    in_event = False

    for line in unfolded:
        stripped = line.strip()
        if stripped == "BEGIN:VEVENT":
            current = {}
            in_event = True
            continue
        if stripped == "END:VEVENT":
            if current is not None:
                current.setdefault("source_url", feed_url)
                events.append(current)
            current = None
            in_event = False
            continue
        if not in_event or current is None or ":" not in line:
            continue

        left, raw_value = line.split(":", 1)
        segments = left.split(";")
        key = segments[0].upper()
        params: dict[str, str] = {}
        for segment in segments[1:]:
            if "=" in segment:
                param_key, param_value = segment.split("=", 1)
                params[param_key.upper()] = param_value

        value = raw_value.replace("\\,", ",").replace("\\;", ";").replace("\\n", "\n").strip()
        if key in {"SUMMARY", "DESCRIPTION", "LOCATION", "URL", "UID", "CATEGORIES"}:
            current[key] = value
            continue
        if key in {"DTSTART", "DTEND"}:
            current[key] = _parse_ics_value(value, params)
            continue
        current[key] = value

    return events


def _extract_json_events(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        for key in ("events", "items", "data", "results"):
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
        return [payload]
    return []


def _normalize_event_record(
    *,
    source: str,
    external_id: str,
    title: str,
    description: str | None,
    url: str,
    source_url: str | None,
    location: str | None,
    is_virtual: bool,
    categories: list[str],
    prize_pool: str | None,
    start_date: datetime,
    end_date: datetime | None,
    raw_source_ref: str | None,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    return {
        "source": source,
        "external_id": external_id,
        "title": title,
        "description": description,
        "url": url,
        "source_url": source_url,
        "location": location,
        "is_virtual": is_virtual,
        "categories": categories,
        "prize_pool": prize_pool,
        "start_date": start_date,
        "end_date": end_date,
        "last_seen_at": now,
        "raw_source_ref": raw_source_ref,
    }


async def _upsert_events(records: list[dict[str, Any]]) -> int:
    if not records:
        return 0

    async with AsyncSessionLocal() as session:
        statement = insert(ScrapedEvent).values(records)
        update_columns = {
            "title": statement.excluded.title,
            "description": statement.excluded.description,
            "url": statement.excluded.url,
            "source_url": statement.excluded.source_url,
            "location": statement.excluded.location,
            "is_virtual": statement.excluded.is_virtual,
            "categories": statement.excluded.categories,
            "prize_pool": statement.excluded.prize_pool,
            "start_date": statement.excluded.start_date,
            "end_date": statement.excluded.end_date,
            "last_seen_at": statement.excluded.last_seen_at,
            "raw_source_ref": statement.excluded.raw_source_ref,
        }
        statement = statement.on_conflict_do_update(
            index_elements=[ScrapedEvent.__table__.c.source, ScrapedEvent.__table__.c.external_id],
            set_=update_columns,
        )
        await session.execute(statement)
        await session.commit()
    return len(records)


async def scrape_devpost_events() -> int:
    try:
        content_type, body = _fetch_url(settings.DEVPOST_HACKATHON_URL)
    except (HTTPError, URLError):
        return 0

    if "html" not in content_type and "xml" not in content_type:
        return 0

    soup = BeautifulSoup(body, "html.parser")
    records: list[dict[str, Any]] = []
    for tile in soup.select(".hackathon-tile"):
        link = tile.select_one("a.block-wrapper[href]")
        if link is None:
            continue

        relative_url = link.get("href", "")
        source_url = urljoin(settings.DEVPOST_HACKATHON_URL, relative_url)
        title_node = tile.select_one(".main-content h3")
        title = _clean_text(title_node.get_text(" ", strip=True) if title_node else link.get_text(" ", strip=True))
        if not title:
            continue

        deadline_node = tile.select_one(".submission-period")
        prize_node = tile.select_one(".prize-amount")
        description_node = tile.select_one(".main-content p")

        deadline = _parse_flexible_text_datetime(deadline_node.get_text(" ", strip=True) if deadline_node else None)
        if deadline is None:
            deadline = datetime.now(timezone.utc)

        categories = _dedupe_preserve_order(
            ["hackathon", *_parse_categories(title, description_node.get_text(" ", strip=True) if description_node else None, prize_node.get_text(" ", strip=True) if prize_node else None)],
        )

        slug = _slug_from_url(source_url)
        record = _normalize_event_record(
            source="devpost",
            external_id=f"devpost:{slug}",
            title=title,
            description=_clean_text(description_node.get_text(" ", strip=True) if description_node else None) or None,
            url=source_url,
            source_url=source_url,
            location=None,
            is_virtual=True,
            categories=categories,
            prize_pool=_clean_text(prize_node.get_text(" ", strip=True) if prize_node else None) or None,
            start_date=deadline,
            end_date=deadline,
            raw_source_ref=slug,
        )
        records.append(record)

    return await _upsert_events(records)


def _normalize_luma_json_event(raw_event: dict[str, Any], feed_url: str) -> dict[str, Any] | None:
    title = _clean_text(
        raw_event.get("title")
        or raw_event.get("name")
        or raw_event.get("summary")
        or raw_event.get("event_title")
    )
    if not title:
        return None

    event_url = _clean_text(
        raw_event.get("url")
        or raw_event.get("event_url")
        or raw_event.get("public_url")
        or raw_event.get("link")
    ) or feed_url
    source_url = _clean_text(raw_event.get("source_url") or feed_url) or feed_url
    raw_id = _clean_text(raw_event.get("id") or raw_event.get("event_id") or raw_event.get("uid"))
    external_id = f"luma:{raw_id or _slug_from_url(event_url)}"

    start_date = _parse_isoish(
        raw_event.get("start_date")
        or raw_event.get("starts_at")
        or raw_event.get("start")
        or raw_event.get("begin_at")
        or raw_event.get("start_time")
    )
    if start_date is None:
        return None

    end_date = _parse_isoish(raw_event.get("end_date") or raw_event.get("ends_at") or raw_event.get("end") or raw_event.get("end_time"))
    description = _clean_text(raw_event.get("description") or raw_event.get("summary") or raw_event.get("details")) or None
    location = _clean_text(raw_event.get("location") or raw_event.get("venue") or raw_event.get("address")) or None
    explicit_virtual = raw_event.get("is_virtual")
    if explicit_virtual is None:
        explicit_virtual = raw_event.get("virtual")
    categories = _dedupe_preserve_order(
        _normalize_category_values(raw_event.get("categories"))
        + _normalize_category_values(raw_event.get("tags"))
        + _parse_categories(title, description, location)
    )
    prize_pool = _clean_text(raw_event.get("prize_pool") or raw_event.get("prize") or raw_event.get("prize_amount")) or None

    return _normalize_event_record(
        source="luma",
        external_id=external_id,
        title=title,
        description=description,
        url=event_url,
        source_url=source_url,
        location=location,
        is_virtual=_infer_is_virtual(location, explicit_virtual),
        categories=categories,
        prize_pool=prize_pool,
        start_date=start_date,
        end_date=end_date,
        raw_source_ref=raw_id or external_id,
    )


def _normalize_luma_ics_event(raw_event: dict[str, Any], feed_url: str) -> dict[str, Any] | None:
    title = _clean_text(raw_event.get("SUMMARY"))
    if not title:
        return None

    external_ref = _clean_text(raw_event.get("UID") or raw_event.get("URL") or title)
    if external_ref.startswith("http"):
        external_ref_slug = _slug_from_url(external_ref)
    else:
        external_ref_slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", external_ref).strip("-").lower()
    external_id = f"luma:{external_ref_slug}"
    if external_id == "luma:":
        external_id = f"luma:{hashlib.sha1(title.encode('utf-8')).hexdigest()[:12]}"

    event_url = _clean_text(raw_event.get("URL") or feed_url) or feed_url
    source_url = feed_url
    start_date = raw_event.get("DTSTART")
    if start_date is None:
        return None
    end_date = raw_event.get("DTEND")
    description = _clean_text(raw_event.get("DESCRIPTION")) or None
    location = _clean_text(raw_event.get("LOCATION")) or None
    categories = _dedupe_preserve_order(
        _normalize_category_values(raw_event.get("CATEGORIES"))
        + _parse_categories(title, description, location)
    )
    return _normalize_event_record(
        source="luma",
        external_id=external_id,
        title=title,
        description=description,
        url=event_url,
        source_url=source_url,
        location=location,
        is_virtual=_infer_is_virtual(location),
        categories=categories,
        prize_pool=None,
        start_date=start_date,
        end_date=end_date,
        raw_source_ref=_clean_text(raw_event.get("UID")) or external_id,
    )


def _meta_content(soup: BeautifulSoup, *names: str) -> str | None:
    for name in names:
        tag = soup.find("meta", attrs={"property": name}) or soup.find("meta", attrs={"name": name})
        if tag and tag.get("content"):
            value = _clean_text(tag.get("content"))
            if value:
                return value
    return None


def _extract_json_ld_objects(soup: BeautifulSoup) -> list[dict[str, Any]]:
    objects: list[dict[str, Any]] = []
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = script.string or script.get_text(strip=True)
        if not raw:
            continue
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            if isinstance(payload.get("@graph"), list):
                objects.extend(item for item in payload["@graph"] if isinstance(item, dict))
            objects.append(payload)
        elif isinstance(payload, list):
            objects.extend(item for item in payload if isinstance(item, dict))
    return objects


def _extract_luma_candidate_urls(soup: BeautifulSoup, page_url: str) -> list[str]:
    skip_prefixes = ("subscribe", "follow ", "sign in", "discover", "pricing", "help", "get the app", "submit event")
    page_abs = page_url.rstrip("/")
    candidates: list[str] = []

    def add_candidate(href: str | None, label: str | None = None) -> None:
        if not href:
            return
        absolute = urljoin(page_url, href).rstrip("/")
        if absolute == page_abs:
            return
        parsed = urlparse(absolute)
        host = parsed.netloc.lower()
        if host and not any(domain in host for domain in ("luma.com", "lu.ma")):
            return
        path = parsed.path.strip("/")
        if not path:
            return
        text = _clean_text(label).lower()
        if text and any(text.startswith(prefix) for prefix in skip_prefixes):
            return
        if any(token in path.lower() for token in ("pricing", "help", "discover", "signin", "sign-in", "signup", "home")):
            return
        candidates.append(absolute)

    for anchor in soup.select("a[href]"):
        text = _clean_text(anchor.get_text(" ", strip=True) or anchor.get("aria-label") or anchor.get("title"))
        add_candidate(anchor.get("href"), text)

    for heading in soup.select("h1, h2, h3, h4"):
        text = _clean_text(heading.get_text(" ", strip=True))
        if not text:
            continue
        parent_anchor = heading.find_parent("a", href=True)
        if parent_anchor is not None:
            add_candidate(parent_anchor.get("href"), text)
            continue
        surrounding_anchor = heading.find_next("a", href=True)
        if surrounding_anchor is not None:
            add_candidate(surrounding_anchor.get("href"), text)

    return _dedupe_preserve_order(candidates)


def _normalize_luma_page_event(soup: BeautifulSoup, page_url: str) -> dict[str, Any] | None:
    h1 = soup.find("h1")
    title = _clean_text(
        _meta_content(soup, "og:title", "twitter:title")
        or (soup.title.get_text(" ", strip=True) if soup.title else None)
        or (h1.get_text(" ", strip=True) if h1 else None)
    )
    if not title:
        return None

    description = _clean_text(
        _meta_content(soup, "og:description", "twitter:description", "description")
        or ""
    ) or None
    canonical = _clean_text(
        _meta_content(soup, "og:url")
        or (soup.find("link", rel="canonical").get("href") if soup.find("link", rel="canonical") else None)
        or page_url
    ) or page_url

    json_ld_objects = _extract_json_ld_objects(soup)
    event_obj: dict[str, Any] | None = None
    for obj in json_ld_objects:
        obj_type = obj.get("@type")
        if isinstance(obj_type, list):
            types = {_clean_text(item).lower() for item in obj_type}
            if "event" in types:
                event_obj = obj
                break
        elif _clean_text(obj_type).lower() == "event":
            event_obj = obj
            break

    payload = event_obj or {}
    event_url = _clean_text(payload.get("url") or canonical) or canonical
    description = _clean_text(payload.get("description") or description) or None

    start_date = _parse_isoish(payload.get("startDate") or payload.get("start_date") or payload.get("start"))
    if start_date is None:
        return None
    end_date = _parse_isoish(payload.get("endDate") or payload.get("end_date") or payload.get("end"))

    location_value: Any = payload.get("location")
    location = None
    if isinstance(location_value, dict):
        location = _clean_text(
            location_value.get("name")
            or location_value.get("address", {}).get("streetAddress")
            or location_value.get("address", {}).get("addressLocality")
        ) or None
    elif isinstance(location_value, str):
        location = _clean_text(location_value) or None

    organizer = payload.get("organizer")
    if not description and organizer:
        if isinstance(organizer, dict):
            description = _clean_text(organizer.get("name")) or None
        elif isinstance(organizer, str):
            description = _clean_text(organizer) or None

    categories = _dedupe_preserve_order(
        _normalize_category_values(payload.get("keywords"))
        + _normalize_category_values(payload.get("genre"))
        + _parse_categories(title, description, location)
    )
    if not categories:
        categories = _parse_categories(title, description, location)

    explicit_virtual = payload.get("eventAttendanceMode")
    if isinstance(explicit_virtual, str):
        explicit_virtual = "online" in explicit_virtual.lower()
    if explicit_virtual is None and isinstance(payload.get("location"), dict):
        location_type = _clean_text(payload["location"].get("@type")).lower()
        if location_type == "virtuallocation":
            explicit_virtual = True

    raw_source_ref = _slug_from_url(page_url)
    if event_url and event_url != page_url:
        raw_source_ref = _slug_from_url(event_url)

    return _normalize_event_record(
        source="luma",
        external_id=f"luma:{_slug_from_url(event_url or page_url)}",
        title=title,
        description=description,
        url=event_url or canonical,
        source_url=page_url,
        location=location,
        is_virtual=_infer_is_virtual(location, explicit_virtual),
        categories=categories,
        prize_pool=None,
        start_date=start_date,
        end_date=end_date,
        raw_source_ref=raw_source_ref,
    )


async def scrape_luma_events() -> int:
    records: list[dict[str, Any]] = []
    page_urls = _split_env_list(settings.LUMA_PAGE_URLS)
    if not page_urls:
        return 0

    seen_external_ids: set[str] = set()

    for page_url in page_urls:
        try:
            content_type, body = _fetch_url(page_url)
        except (HTTPError, URLError):
            continue

        if "html" not in content_type and "xml" not in content_type:
            continue
        soup = BeautifulSoup(body, "html.parser")

        page_record = _normalize_luma_page_event(soup, page_url)
        if page_record is not None and page_record["external_id"] not in seen_external_ids:
            records.append(page_record)
            seen_external_ids.add(page_record["external_id"])

        for candidate_url in _extract_luma_candidate_urls(soup, page_url):
            try:
                candidate_content_type, candidate_body = _fetch_url(candidate_url)
            except (HTTPError, URLError):
                continue
            if "html" not in candidate_content_type:
                continue
            candidate_soup = BeautifulSoup(candidate_body, "html.parser")
            record = _normalize_luma_page_event(candidate_soup, candidate_url)
            if record is None or record["external_id"] in seen_external_ids:
                continue
            records.append(record)
            seen_external_ids.add(record["external_id"])

    return await _upsert_events(records)
