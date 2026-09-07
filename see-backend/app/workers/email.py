from __future__ import annotations

import hashlib
import html
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from google import genai
from google.genai import types
from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.email_ingestion import EmailIngestion
from app.models.job import JobApplication, JobStatus
from app.models.note import Note
from app.models.reminder import Reminder, ReminderPriority
from app.schemas.email import NormalizedEmailIngestPayload
from app.schemas.email import (
    EmailActionRecommendation,
    EmailActionType,
    EmailEntities,
    EmailExtractionResult,
    EmailMessageType,
)
from app.schemas.job import JobApplicationCreate
from app.schemas.note import NoteCreate
from app.schemas.reminder import ReminderCreate


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).split()).strip()


def normalize_mailgun_webhook_payload(payload: dict[str, Any]) -> NormalizedEmailIngestPayload:
    sender = _clean_text(payload.get("sender") or payload.get("from")) or None
    recipient = _clean_text(payload.get("recipient") or payload.get("to")) or None
    subject = _clean_text(payload.get("subject")) or None
    body_plain = _clean_text(payload.get("body-plain") or payload.get("body_plain")) or None
    stripped_text = _clean_text(payload.get("stripped-text") or payload.get("stripped_text") or body_plain or "")
    raw_email = f"<raw_email>{html.escape(stripped_text)}</raw_email>"
    raw_email_hash = hashlib.sha256(stripped_text.encode("utf-8")).hexdigest()
    return NormalizedEmailIngestPayload(
        sender=sender,
        recipient=recipient,
        subject=subject,
        body_plain=body_plain,
        stripped_text=stripped_text,
        raw_email=raw_email,
        raw_email_hash=raw_email_hash,
    )


def build_email_extraction_payload(payload: dict[str, Any]) -> dict[str, Any]:
    normalized = normalize_mailgun_webhook_payload(payload)
    return {
        "sender": normalized.sender,
        "recipient": normalized.recipient,
        "subject": normalized.subject,
        "body_plain": normalized.body_plain,
        "stripped_text": normalized.stripped_text,
        "raw_email": normalized.raw_email,
        "raw_email_hash": normalized.raw_email_hash,
    }


def _gemini_client() -> genai.Client | None:
    if not settings.GEMINI_API_KEY:
        return None
    return genai.Client(api_key=settings.GEMINI_API_KEY.get_secret_value())


def _gemini_prompt(normalized: NormalizedEmailIngestPayload, existing_job: JobApplication | None = None) -> str:
    job_context = ""
    if existing_job is not None:
        job_context = (
            f"\nExisting job context:\n"
            f"- company: {existing_job.company}\n"
            f"- role: {existing_job.role}\n"
            f"- status: {existing_job.status.value}\n"
        )

    return (
        "Extract structured job-email data from the message below.\n"
        "Return only JSON matching the provided schema.\n"
        "Use concise, normalized values.\n"
        "If no good company or role is present, leave them null.\n"
        "Classify the message into the best available message_type.\n"
        "When in doubt, prefer reminder for deadline/follow-up emails, note for general updates, "
        "and unknown only if the message has no useful signal.\n"
        f"{job_context}\n"
        f"Sender: {normalized.sender or ''}\n"
        f"Recipient: {normalized.recipient or ''}\n"
        f"Subject: {normalized.subject or ''}\n"
        f"Body:\n{normalized.body_plain or normalized.stripped_text}\n"
        f"Raw email hash: {normalized.raw_email_hash}\n"
    )


def _generate_email_extraction_with_gemini(
    normalized: NormalizedEmailIngestPayload,
    existing_job: JobApplication | None = None,
) -> EmailExtractionResult | None:
    client = _gemini_client()
    if client is None:
        return None

    prompt = _gemini_prompt(normalized, existing_job=existing_job)
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=EmailExtractionResult,
    )

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=config,
        )
        text = response.text or ""
        if not text.strip():
            return None
        extraction = EmailExtractionResult.model_validate_json(text)
        return extraction.model_copy(update={"raw_email_hash": normalized.raw_email_hash})
    except Exception:
        return None


def _combined_text(normalized: NormalizedEmailIngestPayload) -> str:
    return " ".join(
        part
        for part in (
            normalized.subject or "",
            normalized.body_plain or normalized.stripped_text or "",
            normalized.sender or "",
            normalized.recipient or "",
        )
        if part
    ).strip()


def _display_name_from_sender(sender: str | None) -> str | None:
    if not sender:
        return None
    sender = sender.strip()
    match = re.match(r'(?P<name>[^<"]+)\s*<(?P<email>[^>]+)>', sender)
    if match:
        name = _clean_text(match.group("name"))
        if name:
            return name
        email = match.group("email").strip()
        return email.split("@", 1)[0] if "@" in email else email
    if "@" in sender:
        local_part = sender.split("@", 1)[0]
        local_part = re.sub(r"[\._-]+", " ", local_part)
        return local_part.title().strip() or None
    return _clean_text(sender) or None


def _company_from_sender(sender: str | None) -> str | None:
    display_name = _display_name_from_sender(sender)
    if not display_name:
        return None

    lowered = display_name.lower()
    if lowered in {"noreply", "no reply", "mail delivery subsystem"}:
        return None
    if "@" in lowered:
        domain = lowered.split("@", 1)[-1]
        if domain.endswith(("gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "yahoo.com")):
            return None
    return display_name


def _company_from_text(text: str) -> str | None:
    patterns = [
        r"\b(?:at|from|via)\s+([A-Z][A-Za-z0-9&.\-]+(?:\s+[A-Z][A-Za-z0-9&.\-]+){0,3})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return _clean_text(match.group(1)) or None
    return None


def _role_from_text(text: str) -> str | None:
    patterns = [
        r"\b(?:interview|application|role|position|job)\s+for\s+([A-Z][A-Za-z0-9&./\- ]{2,80}?)(?=\s+(?:we|please|from|at|with|to|scheduled|schedule|will|on|by)\b|[.,;:]|$)",
        r"\b(?:role|position|job)\s+(?:of\s+)?([A-Z][A-Za-z0-9&./\- ]{2,80}?)(?=\s+(?:we|please|from|at|with|to|scheduled|schedule|will|on|by)\b|[.,;:]|$)",
        r"\b(?:job|role)\s*[:\-]\s*([A-Z][A-Za-z0-9&./\- ]{2,80}?)(?=\s+(?:we|please|from|at|with|to|scheduled|schedule|will|on|by)\b|[.,;:]|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return _clean_text(match.group(1)) or None
    return None


def _parse_datetime(text: str) -> datetime | None:
    iso_candidates = [
        r"\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\b",
        r"\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z\b",
        r"\b\d{4}-\d{2}-\d{2}\b",
    ]
    for pattern in iso_candidates:
        match = re.search(pattern, text)
        if match:
            value = match.group(0).replace("Z", "+00:00")
            try:
                parsed = datetime.fromisoformat(value)
            except ValueError:
                continue
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)

    for pattern in ("%b %d, %Y", "%B %d, %Y", "%b %d %Y", "%B %d %Y"):
        try:
            return datetime.strptime(text, pattern).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _infer_message_type(text: str) -> EmailMessageType:
    lowered = text.lower()
    if any(token in lowered for token in ("offer", "compensation", "salary package", "extended an offer")):
        return EmailMessageType.OFFER
    if any(token in lowered for token in ("interview", "screening", "onsite", "on-site", "meeting")):
        return EmailMessageType.INTERVIEW
    if any(token in lowered for token in ("reminder", "deadline", "due", "due date", "follow up", "follow-up")):
        return EmailMessageType.REMINDER
    if any(token in lowered for token in ("application", "applied", "submitted", "position", "role", "job")):
        return EmailMessageType.JOB_APPLICATION
    if any(token in lowered for token in ("hackathon", "meetup", "event", "conference", "workshop")):
        return EmailMessageType.EVENT
    if lowered.strip():
        return EmailMessageType.NOTE
    return EmailMessageType.UNKNOWN


def _build_recommendations(
    message_type: EmailMessageType,
    company: str | None,
    role: str | None,
    deadline: datetime | None,
    summary: str,
    body: str,
    existing_job: JobApplication | None,
) -> list[EmailActionRecommendation]:
    recommendations: list[EmailActionRecommendation] = []

    if message_type in {EmailMessageType.JOB_APPLICATION, EmailMessageType.INTERVIEW, EmailMessageType.OFFER}:
        action = EmailActionType.UPDATE_JOB if existing_job else EmailActionType.CREATE_JOB
        payload: dict[str, Any] = {
            "company": company or "Unknown Company",
            "role": role or (existing_job.role if existing_job else "Unspecified Role"),
            "status": (
                JobStatus.OFFER.value
                if message_type == EmailMessageType.OFFER
                else JobStatus.INTERVIEWING.value
                if message_type == EmailMessageType.INTERVIEW
                else JobStatus.APPLIED.value
            ),
            "interview_notes": summary,
        }
        if deadline is not None:
            payload["deadline"] = deadline.isoformat()
        recommendations.append(EmailActionRecommendation(action=action, confidence=0.92, payload=payload))
        if message_type == EmailMessageType.INTERVIEW and deadline is not None:
            recommendations.append(
                EmailActionRecommendation(
                    action=EmailActionType.CREATE_REMINDER,
                    confidence=0.78,
                    payload={
                        "title": f"Interview follow-up: {company or 'Unknown Company'}",
                        "due_date": deadline.isoformat(),
                        "priority": ReminderPriority.HIGH.value,
                    },
                )
            )
        if message_type == EmailMessageType.OFFER:
            recommendations.append(
                EmailActionRecommendation(
                    action=EmailActionType.CREATE_NOTE,
                    confidence=0.72,
                    payload={
                        "title": f"Offer details: {company or 'Unknown Company'}",
                        "content": body,
                        "tags": "offer,job",
                    },
                )
            )
        return recommendations

    if message_type == EmailMessageType.REMINDER:
        due_at = deadline or (datetime.now(timezone.utc) + timedelta(days=1))
        recommendations.append(
            EmailActionRecommendation(
                action=EmailActionType.CREATE_REMINDER,
                confidence=0.88,
                payload={
                    "title": summary,
                    "due_date": due_at.isoformat(),
                    "priority": ReminderPriority.MEDIUM.value,
                },
            )
        )
        return recommendations

    if message_type in {EmailMessageType.NOTE, EmailMessageType.EVENT}:
        recommendations.append(
            EmailActionRecommendation(
                action=EmailActionType.CREATE_NOTE,
                confidence=0.72,
                payload={
                    "title": summary,
                    "content": body,
                    "tags": "email,event" if message_type == EmailMessageType.EVENT else "email,note",
                },
            )
        )
        return recommendations

    recommendations.append(
        EmailActionRecommendation(
            action=EmailActionType.IGNORE,
            confidence=0.5,
            payload={"summary": summary},
        )
    )
    return recommendations


def infer_email_extraction(
    normalized: NormalizedEmailIngestPayload,
    existing_job: JobApplication | None = None,
) -> EmailExtractionResult:
    text = _combined_text(normalized)
    message_type = _infer_message_type(text)
    company = _company_from_text(text) or _company_from_sender(normalized.sender)
    role = _role_from_text(text)
    deadline = _parse_datetime(text)
    subject = normalized.subject or "Email captured"
    summary = subject if subject else text[:140] or "Captured email"
    confidence = 0.55
    if message_type in {EmailMessageType.JOB_APPLICATION, EmailMessageType.INTERVIEW, EmailMessageType.OFFER}:
        confidence = 0.9
    elif message_type == EmailMessageType.REMINDER:
        confidence = 0.82
    elif message_type in {EmailMessageType.NOTE, EmailMessageType.EVENT}:
        confidence = 0.68

    recommendations = _build_recommendations(
        message_type=message_type,
        company=company,
        role=role,
        deadline=deadline,
        summary=summary,
        body=normalized.body_plain or normalized.stripped_text,
        existing_job=existing_job,
    )
    tags = [tag for tag in ("gmail", message_type.value, "job" if company else None) if tag]
    return EmailExtractionResult(
        message_type=message_type,
        summary=summary,
        confidence=confidence,
        entities=EmailEntities(
            company=company,
            role=role,
            sender=normalized.sender,
            recipient=normalized.recipient,
            deadline=deadline.isoformat() if deadline else None,
        ),
        recommended_actions=recommendations,
        tags=tags,
        raw_email_hash=normalized.raw_email_hash,
    )


async def _find_job_by_company(session, user_id, company: str | None) -> JobApplication | None:
    if not company:
        return None
    result = await session.execute(
        select(JobApplication).where(
            JobApplication.user_id == user_id,
            func.lower(JobApplication.company) == company.lower(),
        )
    )
    return result.scalar_one_or_none()


async def persist_email_extraction(
    normalized: NormalizedEmailIngestPayload,
) -> dict[str, Any]:
    async with AsyncSessionLocal() as session:
        existing = await session.execute(
            select(EmailIngestion).where(EmailIngestion.raw_email_hash == normalized.raw_email_hash)
        )
        record = existing.scalar_one_or_none()
        if record is not None:
            return {
                "duplicate": True,
                "email_ingestion_id": str(record.id),
                "raw_email_hash": record.raw_email_hash,
                "message_type": record.message_type,
            }

        preview = infer_email_extraction(normalized)
        company = preview.entities.company or _company_from_sender(normalized.sender) or "Unknown Company"
        user_id = UUID(settings.DEFAULT_USER_ID) if settings.DEFAULT_USER_ID else None
        existing_job = await _find_job_by_company(session, user_id, company) if user_id else None
        extraction = _generate_email_extraction_with_gemini(normalized, existing_job=existing_job)
        if extraction is None:
            extraction = infer_email_extraction(normalized, existing_job=existing_job)

        record = EmailIngestion(
            raw_email_hash=normalized.raw_email_hash,
            source="gmail",
            sender=normalized.sender,
            recipient=normalized.recipient,
            subject=normalized.subject,
            message_type=extraction.message_type.value,
            summary=extraction.summary,
            confidence=extraction.confidence,
            tags=extraction.tags,
            extraction_result=extraction.model_dump(mode="json"),
        )
        session.add(record)

        created_job: JobApplication | None = None
        created_note: Note | None = None
        created_reminder: Reminder | None = None

        company = extraction.entities.company or _company_from_sender(normalized.sender) or "Unknown Company"
        role = extraction.entities.role or "Unspecified Role"
        deadline = datetime.fromisoformat(extraction.entities.deadline) if extraction.entities.deadline else None

        if user_id is None:
            record.extraction_result = extraction.model_dump(mode="json")
            await session.commit()
            await session.refresh(record)
            return {
                "duplicate": False,
                "email_ingestion_id": str(record.id),
                "raw_email_hash": record.raw_email_hash,
                "message_type": record.message_type,
                "summary": record.summary,
                "linked_job_id": None,
                "linked_reminder_id": None,
                "linked_note_id": None,
            }

        for recommendation in extraction.recommended_actions:
            if recommendation.action in {EmailActionType.CREATE_JOB, EmailActionType.UPDATE_JOB}:
                existing_job = await _find_job_by_company(session, user_id, company)
                if existing_job is None:
                    existing_job = JobApplication(
                        user_id=user_id,
                        company=company,
                        role=role,
                        status=JobStatus(recommendation.payload.get("status", JobStatus.APPLIED.value)),
                        interview_notes=recommendation.payload.get("interview_notes"),
                        deadline=deadline,
                    )
                    session.add(existing_job)
                    created_job = existing_job
                else:
                    existing_job.company = company or existing_job.company
                    if role and (not existing_job.role or existing_job.role == "Unspecified Role"):
                        existing_job.role = role
                    status_value = recommendation.payload.get("status")
                    if status_value:
                        existing_job.status = JobStatus(status_value)
                    if recommendation.payload.get("interview_notes"):
                        existing_job.interview_notes = recommendation.payload["interview_notes"]
                    if deadline is not None:
                        existing_job.deadline = deadline
                    created_job = existing_job
            elif recommendation.action == EmailActionType.CREATE_REMINDER:
                reminder_due = deadline or datetime.fromisoformat(recommendation.payload["due_date"])
                created_reminder = Reminder(
                    user_id=user_id,
                    title=recommendation.payload.get("title", extraction.summary),
                    due_date=reminder_due,
                    priority=ReminderPriority(recommendation.payload.get("priority", ReminderPriority.MEDIUM.value)),
                )
                session.add(created_reminder)
            elif recommendation.action == EmailActionType.CREATE_NOTE:
                created_note = Note(
                    user_id=user_id,
                    title=recommendation.payload.get("title", extraction.summary),
                    content=recommendation.payload.get("content", normalized.body_plain or normalized.stripped_text),
                    tags=recommendation.payload.get("tags"),
                )
                session.add(created_note)

        record.linked_job_id = getattr(created_job, "id", None)
        record.linked_reminder_id = getattr(created_reminder, "id", None)
        record.linked_note_id = getattr(created_note, "id", None)
        await session.commit()
        await session.refresh(record)
        return {
            "duplicate": False,
            "email_ingestion_id": str(record.id),
            "raw_email_hash": record.raw_email_hash,
            "message_type": record.message_type,
            "summary": record.summary,
            "linked_job_id": str(record.linked_job_id) if record.linked_job_id else None,
            "linked_reminder_id": str(record.linked_reminder_id) if record.linked_reminder_id else None,
            "linked_note_id": str(record.linked_note_id) if record.linked_note_id else None,
        }
