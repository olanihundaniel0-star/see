"""Bounded, extractive event descriptions shared by all event API responses."""
from __future__ import annotations

import re

from bs4 import BeautifulSoup


MAX_DESCRIPTION_CHARS = 480
MAX_DESCRIPTION_WORDS = 75
MAX_DESCRIPTION_SENTENCES = 3
BOILERPLATE = re.compile(
    r"\b(?:unsubscribe|privacy policy|terms (?:of service|and conditions)|all rights reserved|"
    r"follow us|follow (?:our|the) .{0,20}(?:social|instagram|twitter|linkedin)|"
    r"subscribe (?:to|for)|join our (?:whatsapp|telegram|discord)|"
    r"share (?:this|the) event|download (?:the|our) app|powered by (?:luma|lu\.ma)|"
    r"cookie (?:policy|preferences)|by (?:registering|attending).{0,100}(?:consent|agree)|"
    r"photo(?:graphy)? (?:consent|release))\b",
    re.I,
)
ORGANIZER_HEADING = re.compile(r"^(?:about (?:the |our )?(?:organizers?|hosts?|sponsors?)|our sponsors|sponsors?)\s*:?$", re.I)
USEFUL_DETAIL = re.compile(r"\b(?:learn|build|workshop|hackathon|hands.on|bring|prerequisite|eligib\w*|required|deadline|registration closes|prizes?|free|fee|cost|beginners?|experience)\b", re.I)


def compact_event_description(value: str | None) -> str | None:
    if not value or not value.strip():
        return None
    # Bound parsing work for unexpectedly large scraped documents. The stored
    # source description is untouched; this function is a presentation boundary.
    soup = BeautifulSoup(value[:50_000], "html.parser")
    for element in soup.select("script, style, nav, footer, form, iframe"):
        element.decompose()
    for element in soup.find_all(["p", "div", "br", "li", "h1", "h2", "h3", "h4"]):
        element.insert_before("\n")
        element.insert_after("\n")
    plain = soup.get_text()
    plain = re.sub(r"\[([^\]]+)\]\(https?://[^)]+\)", r"\1", plain)
    plain = re.sub(r"https?://\S+", "", plain)
    candidates: list[str] = []
    seen: set[str] = set()
    skip_section = False
    for line in plain.splitlines():
        line = re.sub(r"[\u200b-\u200d\ufeff]", "", line)
        line = " ".join(line.split()).strip(" #*•-\t")
        if ORGANIZER_HEADING.fullmatch(line):
            skip_section = True
            continue
        if skip_section:
            if re.match(r"^(?:agenda|schedule|requirements|eligibility|prizes|what (?:you|to)|registration|tickets)\b", line, re.I):
                skip_section = False
            else:
                continue
        for sentence in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])", line):
            sentence = sentence.strip()
            key = sentence.casefold()
            if not sentence or not re.search(r"\w", sentence) or key in seen or BOILERPLATE.search(sentence):
                continue
            seen.add(key)
            candidates.append(sentence)
    if not candidates:
        return None
    # Keep the opening explanation and prefer practical details over subsequent
    # promotional prose. Preserve source order, and never invent facts.
    ranked = sorted(range(1, len(candidates)), key=lambda i: (not bool(USEFUL_DETAIL.search(candidates[i])), i))
    indexes = sorted([0, *ranked[:MAX_DESCRIPTION_SENTENCES - 1]])
    summary = " ".join(candidates[i] for i in indexes)
    words = summary.split()
    shortened = len(words) > MAX_DESCRIPTION_WORDS or len(summary) > MAX_DESCRIPTION_CHARS
    summary = " ".join(words[:MAX_DESCRIPTION_WORDS])
    if len(summary) > MAX_DESCRIPTION_CHARS - (1 if shortened else 0):
        summary = summary[:MAX_DESCRIPTION_CHARS - 1].rsplit(" ", 1)[0]
    if shortened:
        summary = summary.rstrip(" ,;:.!?") + "…"
    return summary or None
