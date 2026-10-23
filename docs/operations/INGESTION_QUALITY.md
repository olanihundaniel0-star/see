# Job import and event description policy

The backend imports application correspondence from email. It does not discover
vacancies on job boards or verify that an employer or opening is legitimate.

## Automatic job admission

`app/services/job_import.py` is the final admission check, after AI extraction or
the local fallback. Automatic job writes require all of:

- A direct recruitment phrase in the current email, such as an application
  acknowledgement, interview invitation, assessment request, employment offer,
  rejection, or recruiter outreach. Broad terms like "meeting" and "offer" do
  not qualify on their own.
- Company and role explicitly present in the current subject/body. Sender names,
  quoted replies and signatures do not supply missing entities.
- Career classification and both extraction/action confidence of at least 0.85.
  These are policy thresholds, not calibrated probabilities of authenticity.
- Authenticated sender metadata. Gmail checks the first Authentication-Results
  header for mx.google.com, DMARC pass, and a matching header.from domain.
- An unambiguous existing application match, if one exists.

Job status comes from the source evidence rather than the model's action payload.
Recruiter outreach starts as bookmarked, not applied. Unknown dates are left
unset; reminders are not assigned a fabricated due date. Sender authentication
alone does not prove that a business or offer is genuine.
Old confirmations cannot reset interview progress, and changes to offer,
rejected or archived applications require review when the status conflicts.

Uncertain items are retained in `email_ingestions.extraction_result.validation`
with a status (`accepted`, `review`, `ignored`), reason codes and the matched
phrase. They do not create applications, fallback notes or reminders. This is
backend audit metadata; there is no review screen in the app yet. The Gmail
prefilter still marks obviously irrelevant/promotional mail read in the dedicated
ingestion inbox without importing it. Existing email-hash deduplication remains.

Email processing never creates personal notes, including for accepted offers.
Career summaries stay on applications; other extracted suggestions remain in the
ingestion audit. Existing notes are preserved rather than bulk-deleted.
The Notes API supports `source=manual`, `source=email`, or `source=all` (the
backwards-compatible default). Classification uses `email_ingestions.linked_note_id`,
not user-editable tags. The updated app defaults to My notes and exposes earlier
linked imports separately. Older records without an ingestion link cannot be
reliably classified automatically and remain visible as manual notes.

Mailgun's signed webhook currently authenticates transport but does not establish
sender authentication. Its messages therefore remain in review until the adapter
can supply independently verified sender metadata. Do not accept a sender-supplied
boolean as a substitute. Forwarded messages and recruitment messages without an
explicit company/role may also need review. The current phrase rules target
English correspondence; other languages need dedicated fixtures and rules.

Manual job creation remains user-directed, with server-side required text checks
for company and role. It does not claim semantic or external vacancy verification.
No existing jobs are automatically deleted or reclassified by this change.

## Event descriptions

Every `EventRead` response uses `app/services/event_text.py`, covering Luma,
Devpost and other sources, including events already stored before deployment.
Descriptions are extractive (no additional model call) and limited to 75 words,
480 characters and at most three selected text segments. HTML, scripts, common
social/subscription/legal boilerplate, repeated sentences and organizer biography
sections are removed. The opening explanation and practical details are preferred.

Stored source descriptions remain intact, and Luma imports preserve paragraph
boundaries for better cleanup. Date, location, categories, prize information and
the source URL remain separate API fields. Users can open the source for full
rules, eligibility, schedules and any details omitted from the short description.
Category inference uses word boundaries so words such as "fair" do not become AI.

## Verification and rollout

Run `python -m pytest -q` in `see-backend` with test-safe database/Redis settings
and AI credentials disabled. `tests/test_ingestion_quality.py` covers promotional
false positives, grounded evidence, missing/low-confidence entities, sender
authentication, quoted threads, duplicates, ambiguous matches and event summaries.

Deploy both the API and email workers together. No database migration or mobile
rebuild is required. Existing long event descriptions become concise on the next
API fetch. Inspect validation reasons using backend database tooling; review
existing suspicious application records before performing a separate cleanup.
