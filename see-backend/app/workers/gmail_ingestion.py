from __future__ import annotations

import imaplib
from email import message_from_bytes
from email.header import decode_header
from typing import Any

from app.core.config import settings


DEFAULT_IMAP_HOST = "imap.gmail.com"
DEFAULT_IMAP_PORT = 993
JOB_KEYWORDS = ("application", "interview", "assessment", "offer", "recruit", "recruiter", "job")


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
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition") or "")
            if content_type == "text/plain" and "attachment" not in content_disposition.lower():
                payload = part.get_payload(decode=True)
                if payload:
                    return payload.decode(errors="ignore")
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            return payload.decode(errors="ignore")
    return ""


def _looks_relevant(sender: str, subject: str, body: str) -> bool:
    haystack = f"{sender} {subject} {body}".lower()
    return any(keyword in haystack for keyword in JOB_KEYWORDS)


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
        return []

    try:
        status, messages = mail.search(None, "UNSEEN")
        if status != "OK" or not messages or not messages[0]:
            return []

        parsed_emails: list[dict[str, Any]] = []
        # Keep each scheduled invocation bounded. Remaining unread messages are handled next run.
        message_ids = messages[0].split()[-max(settings.GMAIL_MAX_MESSAGES_PER_POLL, 1) :]
        for e_id in message_ids:
            res, data = mail.fetch(e_id, "(RFC822)")
            if res != "OK" or not data or not data[0]:
                continue

            raw_email = data[0][1]
            msg = message_from_bytes(raw_email)
            sender = clean_header(msg.get("From"))
            subject = clean_header(msg.get("Subject"))
            body = extract_body(msg)

            if not _looks_relevant(sender, subject, body):
                continue

            stripped_text = " ".join(body.split()).strip()
            raw_email = f"<raw_email>{stripped_text}</raw_email>"
            parsed_emails.append(
                {
                    "sender": sender,
                    "recipient": clean_header(msg.get("To")) or None,
                    "subject": subject,
                    "body_plain": body,
                    "stripped_text": stripped_text,
                    "raw_email": raw_email,
                    "raw_email_hash": "",
                }
            )
            mail.store(e_id, "+FLAGS", "\\Seen")

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
