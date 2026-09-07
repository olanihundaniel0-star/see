# See Integration Contract

Date: 2026-09-07

This document is the source of truth for external data ingestion and email extraction behavior.
It resolves the integration ambiguities called out during planning and should be treated as the
implementation contract for the backend workers and API endpoints.

## 1. Event Ingestion Model

The scraped event record is extended to support richer feed metadata and auditability.

### Required fields

| Field | Type | Purpose |
| --- | --- | --- |
| `source` | `VARCHAR(50)` | Provider name such as `devpost` or `luma`. |
| `external_id` | `VARCHAR(255)` | Provider-scoped unique identifier. |
| `title` | `VARCHAR(255)` | Sanitized display title. |
| `description` | `TEXT` | Optional extended description. |
| `url` | `TEXT` | Canonical public event URL. |
| `source_url` | `TEXT` | Raw provider URL used during ingestion. |
| `location` | `VARCHAR(255)` | Optional location string. |
| `is_virtual` | `BOOLEAN` | Virtual event flag. |
| `categories` | `TEXT[]` | Normalized category slugs used for filtering. |
| `prize_pool` | `VARCHAR(255)` | Raw prize text when the source exposes prize data. |
| `start_date` | `TIMESTAMPTZ` | Normalized start timestamp in UTC. |
| `end_date` | `TIMESTAMPTZ` | Optional normalized end timestamp in UTC. |
| `last_seen_at` | `TIMESTAMPTZ` | Timestamp of the most recent successful scrape or refresh. |
| `raw_source_ref` | `VARCHAR(255)` | Stable provider reference for audit/debug purposes. |

### Auditability choice

Use `raw_source_ref` rather than storing the full payload on the main event row.
It is enough to trace where a record came from without bloating the table with large provider blobs.
If full payload retention is needed later, it should live in a separate ingestion audit table.

## 2. Deduplication Policy

Deduplication is **source-local**.

- A provider updates the same logical event by reusing the same `external_id`.
- The upsert key is `external_id` within the provider namespace.
- There is no cross-source merging at ingest time.
- If the same real-world event appears in Devpost and Luma, both records are retained unless a later
  canonicalization layer is added explicitly.

Recommended database behavior:

- `ON CONFLICT (external_id) DO UPDATE`
- Refresh `title`, `description`, `url`, `source_url`, `location`, `is_virtual`, `categories`,
  `prize_pool`, `start_date`, `end_date`, and `last_seen_at`
- Preserve stable identity fields such as `id`, `source`, and `external_id`

## 3. Devpost Adapter

### Source

- Target URL: `https://devpost.com/hackathons?challenge_type[]=online&sort_by=submission_deadline`
- Source name: `devpost`

### Scrape contract

- Selector root: `.hackathon-tile`
- Title: `.main-content h3`
- Deadline: `.submission-period`
- Prize pool: `.prize-amount`
- URL: `a.block-wrapper[href]`
- External ID: slug extracted from the challenge link, prefixed with `devpost:`

### Normalization rules

- `source_url` is the exact Devpost challenge link.
- `url` is the canonical external link used in the UI.
- `categories` may include `hackathon`, `developer`, or other normalized tags inferred from the card.
- `prize_pool` is stored as raw text exactly as published.
- `last_seen_at` updates every time the scraper sees the record, even if no other fields changed.

## 4. Luma Adapter

Luma events are imported from public web pages.

### Import model

- Use category, city, or calendar pages as entry points
- Discover event links from those pages
- Fetch each event page and normalize the event data from page metadata and structured data
- Keep the same `external_id` shape for the same event page so the event stays stable across runs

### Source contract

- Source name: `luma`
- External ID format: `luma:{event_page_slug}`
- `source_url` stores the page used to discover the event

### Category mapping

Normalize Luma tags into the shared event taxonomy:

- `developer`
- `open_source`
- `ai`
- `web3`

Additional tags may be added later, but the importer should always emit normalized slugs.

### Virtuality rules

- `is_virtual = true` when the event is fully online or lacks a physical venue.
- `is_virtual = false` when the event has a real-world venue/location.

### Configuration

- `LUMA_PAGE_URLS` should contain comma-separated public Luma pages to crawl, such as city pages, category pages, or calendar pages
- Leave the old feed settings empty unless you are intentionally keeping legacy compatibility

## 5. Gmail Inbox Ingestion

The email pipeline is Gmail-first. Gmail IMAP polling is the primary source of inbox data for this project.
The legacy webhook route remains available for compatibility, but it is not the default path.

### Source

- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`

### Polling behavior

- Poll unread messages from Gmail over IMAP
- Filter for job-related keywords such as application, interview, assessment, offer, recruiter, and job
- Mark matched messages as read after they are queued for extraction

### Normalization

- Read `From`, `To`, `Subject`, and plain-text body
- Sanitize the body and wrap it in:

```text
<raw_email>...</raw_email>
```

- Generate a stable `raw_email_hash` from the sanitized text

## 6. LLM Email Extraction Schema

The extraction worker must return strict JSON matching the following schema.
The schema is designed to support job updates, reminders, and note capture without requiring free-form parsing.

```json
{
  "message_type": "job_application|interview|offer|reminder|note|event|unknown",
  "summary": "string",
  "confidence": 0.0,
  "entities": {
    "company": "string|null",
    "role": "string|null",
    "sender": "string|null",
    "recipient": "string|null",
    "location": "string|null",
    "deadline": "string|null",
    "event_title": "string|null",
    "event_url": "string|null"
  },
  "recommended_actions": [
    {
      "action": "create_job|update_job|create_reminder|create_note|ignore",
      "confidence": 0.0,
      "payload": {}
    }
  ],
  "tags": ["string"],
  "raw_email_hash": "string"
}
```

### Schema rules

- `message_type` is the top-level classification.
- `summary` is a short normalized description for UI display.
- `confidence` is a 0 to 1 score for the top-level classification.
- `entities.deadline` must be ISO-8601 when present.
- `recommended_actions` is optional in practice but should always be emitted as an array.
- `payload` must be a machine-readable object shaped for the selected action.
- `raw_email_hash` is a stable fingerprint of the sanitized input for traceability.

### LLM provider configuration

The default extractor is Gemini-hosted and should be configured with:

- `GEMINI_API_KEY`
- `GEMINI_MODEL` = `gemini-2.5-flash`
- `GEMINI_FALLBACK_MODEL` = `gemini-2.5-flash-lite`

The heuristic extractor remains available as a fallback when the LLM provider is unavailable.

## 7. Implementation Notes

- Event ingest code should update `last_seen_at` on every successful refresh.
- Event filters in the API should treat `categories` as the primary discovery field.
- Email extraction must remain stateless; the queue task should be able to run independently of the API process.
- Gmail polling is the primary inbox source. Keep the webhook path only as a compatibility fallback.
- Any future cross-source canonicalization should be a separate service or offline job, not part of the initial ingest path.
