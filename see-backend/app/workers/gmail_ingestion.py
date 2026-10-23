from __future__ import annotations

import imaplib
import logging
import re
from email import message_from_bytes
from email.header import decode_header
from email.utils import parseaddr
from typing import Any

from app.core.config import settings
from app.services.job_import import CAREER_CANDIDATE, MARKETING, career_signal, current_message_text


logger = logging.getLogger(__name__)


DEFAULT_IMAP_HOST = "imap.gmail.com"
DEFAULT_IMAP_PORT = 993


def clean_header(header_val: str | None) -> str:
    if not header_val:
        return ""

    decoded_parts: list[str] = []
    for part, charset in decode_header(header_val):
        if isinstance(part, bytes):
            decoded_parts.append(part.decode(charset or "utf-8", errors="ignore"))
        else:
            decoded_parts.append(str(part))
    return " ".join(piece.strip() for piece in decoded_parts if piece and piece.strip())


def extract_body(msg) -> str:
    bodies: dict[str, str] = {}

    def collect(part):
        if part.get_content_disposition() == "attachment" or part.get_content_maintype() == "message":
            return
        if part.is_multipart():
            for child in part.get_payload():
                collect(child)
            return
        kind = part.get_content_type()
        if kind not in {"text/plain", "text/html"} or kind in bodies:
            return
        payload = part.get_payload(decode=True)
        if payload:
            try:
                bodies[kind] = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
            except LookupError:
                bodies[kind] = payload.decode("utf-8", errors="replace")

    collect(msg)
    # Many recruitment systems send HTML-only alternatives. The admission
    # service strips markup and quoted content from this fallback.
    return bodies.get("text/plain", "").strip() or bodies.get("text/html", "")


def _looks_relevant(sender: str, subject: str, body: str) -> bool:
    # Sender addresses (e.g. jobs@...) do not establish relevance. Borderline
    # career messages reach the audited admission step; obvious marketing does not.
    text = current_message_text(subject, body)
    return not MARKETING.search(text) and bool(career_signal(text)[0] or CAREER_CANDIDATE.search(text))


def _sender_authenticated(msg, sender: str) -> bool:
    """Use Gmail's first authentication result, never a later sender-supplied one."""
    results = msg.get_all("Authentication-Results", [])
    if not results:
        return False
    result = " ".join(str(results[0]).split()).lower()
    address = parseaddr(sender)[1]
    domain = address.rsplit("@", 1)[-1].lower() if "@" in address else ""
    return bool(
        domain
        and re.match(r"^mx\.google\.com\s*;", result)
        and re.search(r"\bdmarc=pass(?:\s|;|$)", result)
        and re.search(r"\bheader\.from=" + re.escape(domain) + r"(?:\s|;|$)", result)
    )


def fetch_unread_job_emails() -> list[dict[str, Any]]:
    gmail_user = settings.GMAIL_USER
    gmail_password = settings.GMAIL_APP_PASSWORD.get_secret_value() if settings.GMAIL_APP_PASSWORD else None

    if not gmail_user or not gmail_password:
        return []

    # A scheduler request must not be held indefinitely by a stalled IMAP connection.
    mail = imaplib.IMAP4_SSL(
        DEFAULT_IMAP_HOST,
        DEFAULT_IMAP_PORT,
        timeout=max(settings.GMAIL_IMAP_TIMEOUT_SECONDS, 1),
    )
    try:
        mail.login(gmail_user, gmail_password)
        mail.select("inbox")
    except imaplib.IMAP4.error:
        logger.error("Gmail IMAP login/select failed; returning no messages")
        return []

    try:
        status, messages = mail.uid("search", None, "UNSEEN")
        if status != "OK" or not messages or not messages[0]:
            return []

        parsed_emails: list[dict[str, Any]] = []
        # Keep each scheduled invocation bounded and drain oldest-first so a
        # backlog cannot be permanently masked by newer mail. BODY.PEEK avoids
        # setting \Seen as a side effect; relevant mail is marked seen only after
        # it has been persisted.
        uids = [uid.decode("ascii") for uid in messages[0].split()[: max(settings.GMAIL_MAX_MESSAGES_PER_POLL, 1)]]
        for uid in uids:
            res, data = mail.uid("fetch", uid, "(BODY.PEEK[])")
            if res != "OK" or not data or not data[0]:
                continue

            raw_email = data[0][1]
            msg = message_from_bytes(raw_email)
            sender = clean_header(msg.get("From"))
            subject = clean_header(msg.get("Subject"))
            body = extract_body(msg)

            if not _looks_relevant(sender, subject, body):
                # This is the dedicated ingestion inbox, so non-job mail is
                # marked read once evaluated to keep the unread window moving.
                try:
                    mail.uid("store", uid, "+FLAGS", "\\Seen")
                except imaplib.IMAP4.error:
                    pass
                continue

            stripped_text = " ".join(body.split()).strip()
            raw_email = f"<raw_email>{stripped_text}</raw_email>"
            parsed_emails.append(
                {
                    "uid": uid,
                    "message_id": clean_header(msg.get("Message-ID")) or None,
                    "sender_verified": _sender_authenticated(msg, sender),
                    "sender": sender,
                    "recipient": clean_header(msg.get("To")) or None,
                    "subject": subject,
                    "body_plain": body,
                    "stripped_text": stripped_text,
                    "raw_email": raw_email,
                    "raw_email_hash": "",
                }
            )

        return parsed_emails
    finally:
        try:
            mail.close()
        except Exception:
            pass
        try:
            mail.logout()
        except Exception:
            pass


def mark_seen_by_uids(uids: list[str]) -> None:
    """Mark messages as \\Seen only after they have been persisted successfully."""
    if not uids:
        return

    gmail_user = settings.GMAIL_USER
    gmail_password = settings.GMAIL_APP_PASSWORD.get_secret_value() if settings.GMAIL_APP_PASSWORD else None
    if not gmail_user or not gmail_password:
        return

    mail = imaplib.IMAP4_SSL(
        DEFAULT_IMAP_HOST,
        DEFAULT_IMAP_PORT,
        timeout=max(settings.GMAIL_IMAP_TIMEOUT_SECONDS, 1),
    )
    try:
        mail.login(gmail_user, gmail_password)
        mail.select("inbox")
    except imaplib.IMAP4.error:
        logger.warning("Gmail IMAP login/select failed in mark_seen_by_uids; uids left unseen")
        return

    try:
        for uid in uids:
            try:
                mail.uid("store", uid, "+FLAGS", "\\Seen")
            except imaplib.IMAP4.error:
                continue
    finally:
        try:
            mail.close()
        except Exception:
            pass
        try:
            mail.logout()
        except Exception:
            pass
