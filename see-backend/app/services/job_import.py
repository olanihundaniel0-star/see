"""Conservative admission rules for email-created applications.

Model confidence is only one signal. Every automatic write also needs evidence
in the current message and authenticated sender metadata from the mail adapter.
These checks establish relevance, not that an employer or vacancy is genuine.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from bs4 import BeautifulSoup

from app.schemas.email import EmailActionType, EmailExtractionResult, NormalizedEmailIngestPayload


MIN_JOB_CONFIDENCE = 0.85
CAREER_TYPES = {"job_application", "interview", "offer"}
JOB_ACTIONS = {EmailActionType.CREATE_JOB, EmailActionType.UPDATE_JOB}

# Match phrases about recruitment, rather than words such as "offer" or
# "application", which also occur in shopping, software and event newsletters.
SIGNALS = (
    ("offer", r"\b(?:offer of employment|employment offer|job offer|offer letter)\b"),
    ("offer", r"\b(?:pleased|delighted|excited) to offer you (?:the |a |an )?(?:position|role)\b"),
    ("rejected", r"\b(?:not (?:be )?moving forward with your application|application (?:was|has been) unsuccessful|decided not to proceed with your application)\b"),
    ("interviewing", r"\b(?:your interview|invite you (?:to|for) (?:an? |the )?interview|interview (?:invitation|scheduled|confirmation)|schedule (?:an? |your |the )?interview)\b"),
    ("assessment", r"\b(?:your (?:technical |coding )?assessment|complete (?:the |a |our )?(?:technical|coding|take.home) (?:assessment|test|challenge))\b"),
    ("applied", r"\b(?:thank(?:s| you) for applying|thank(?:s| you) for your application|(?:we (?:have |have successfully )?)?received your application|your application (?:has been|was) (?:received|submitted|reviewed)|application (?:received|confirmation|update))\b"),
    ("bookmarked", r"\b(?:we(?:'re| are) (?:hiring|recruiting|seeking)|(?:job|career) opportunity|open (?:position|role)|join our team as)\b"),
)
SIGNAL_PATTERNS = tuple((status, re.compile(pattern, re.I)) for status, pattern in SIGNALS)
CAREER_CANDIDATE = re.compile(r"\b(?:job|jobs|recruit(?:er|ing|ment)?|hiring|interview|employment|application|assessment|position|role)\b", re.I)
MARKETING = re.compile(
    r"\b(?:special offer|limited.time offer|promo code|coupon|flash sale|job alerts?|jobs? digest|"
    r"jobs? (?:recommended|picked) for you|recommended jobs|top \d+ jobs|weekly (?:jobs?|career) (?:digest|roundup)|"
    r"mock interview|interview (?:prep|preparation) (?:course|workshop)|interview coaching)\b|\b\d+\s*%\s*off\b",
    re.I,
)
NON_RECRUITMENT = re.compile(
    r"\b(?:membership|loan|visa|grant|scholarship|hackathon|conference|event) application\b|"
    r"\bapplication for (?:the |our |a |an )?(?:membership|loan|visa|grant|scholarship|hackathon|conference|event)\b|"
    r"\b(?:not (?:a |an )?(?:job offer|offer of employment)|sample offer letter|job offer template)\b",
    re.I,
)


def current_message_text(subject: str | None, body: str | None) -> str:
    """Exclude quoted threads/signatures so old recruitment text cannot qualify new mail."""
    soup = BeautifulSoup((body or "")[:50_000], "html.parser")
    for element in soup.select("script, style, blockquote, .gmail_quote, .gmail_signature"):
        element.decompose()
    for element in soup.find_all(["p", "div", "br", "li"]):
        element.insert_before("\n")
    plain = soup.get_text()
    plain = re.split(r"(?im)^\s*(?:On .{1,250}wrote:|[- ]*Original Message[- ]*|--\s*$|From:\s)", plain, maxsplit=1)[0]
    plain = "\n".join(line for line in plain.splitlines() if not line.lstrip().startswith(">"))
    return " ".join(f"{subject or ''}\n{plain}".split())[:20_000]


def career_signal(text: str) -> tuple[str | None, str | None]:
    if MARKETING.search(text) or NON_RECRUITMENT.search(text):
        return None, None
    for status, pattern in SIGNAL_PATTERNS:
        match = pattern.search(text)
        if match:
            return status, match.group(0)
    return None, None


def _normalized_words(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).casefold()
    return " ".join(re.findall(r"\w+", value))


def _entity_in_message(value: str | None, text: str) -> bool:
    entity = _normalized_words(value or "")
    return bool(entity and f" {entity} " in f" {_normalized_words(text)} ")


@dataclass(frozen=True)
class ImportDecision:
    status: str  # accepted, review, ignored
    reasons: tuple[str, ...]
    job_status: str | None = None
    evidence: str | None = None

    def audit(self) -> dict:
        return {"version": 1, "status": self.status, "reasons": list(self.reasons),
                "job_status": self.job_status, "evidence": self.evidence}


def assess_job_import(message: NormalizedEmailIngestPayload, extraction: EmailExtractionResult) -> ImportDecision:
    text = current_message_text(message.subject, message.body_plain or message.stripped_text)
    status, evidence = career_signal(text)
    actions = [action for action in extraction.recommended_actions if action.action in JOB_ACTIONS]
    if MARKETING.search(text):
        return ImportDecision("ignored", ("promotional_or_bulk_job_message",))
    if NON_RECRUITMENT.search(text):
        return ImportDecision("ignored", ("non_recruitment_context",))
    reasons: list[str] = []
    if status is None:
        reasons.append("no_direct_recruitment_evidence")
    if extraction.message_type.value not in CAREER_TYPES:
        reasons.append("not_classified_as_career_email")
    if not actions:
        reasons.append("no_job_action")
    if extraction.confidence < MIN_JOB_CONFIDENCE or any(action.confidence < MIN_JOB_CONFIDENCE for action in actions):
        reasons.append("low_confidence")
    for name in ("company", "role"):
        value = getattr(extraction.entities, name)
        if not value or not value.strip() or value.casefold().strip() in {"unknown company", "unspecified role"}:
            reasons.append(f"missing_{name}")
        elif len(value) > 150 or not any(char.isalnum() for char in value):
            reasons.append(f"invalid_{name}")
        elif not _entity_in_message(value, text):
            reasons.append(f"{name}_not_in_message")
    if not message.sender_verified:
        reasons.append("sender_not_authenticated")
    if reasons:
        candidate = bool(status or CAREER_CANDIDATE.search(text) or actions)
        return ImportDecision("review" if candidate else "ignored", tuple(reasons), status, evidence)
    return ImportDecision("accepted", (), status, evidence)
