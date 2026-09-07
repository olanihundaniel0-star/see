from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import zipfile
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parent
DOCX_PATH = ROOT / "See_PRD.docx"
HTML_PATH = ROOT / "See_PRD.html"

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
CP_NS = "http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
DC_NS = "http://purl.org/dc/elements/1.1/"
DCTERMS_NS = "http://purl.org/dc/terms/"
DCTYPE_NS = "http://purl.org/dc/dcmitype/"
XML_NS = "http://www.w3.org/XML/1998/namespace"
XSI_NS = "http://www.w3.org/2001/XMLSchema-instance"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types"
EXT_PROP_NS = "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
VT_NS = "http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"

PAGE_WIDTH_TWIPS = 12240
PAGE_HEIGHT_TWIPS = 15840
PAGE_MARGIN_TWIPS = 1080
CONTENT_WIDTH_TWIPS = PAGE_WIDTH_TWIPS - (PAGE_MARGIN_TWIPS * 2)


for prefix, uri in (
    ("w", W_NS),
    ("r", R_NS),
    ("cp", CP_NS),
    ("dc", DC_NS),
    ("dcterms", DCTERMS_NS),
    ("dcmitype", DCTYPE_NS),
    ("xsi", XSI_NS),
    ("vt", VT_NS),
):
    ET.register_namespace(prefix, uri)


def q(ns: str, tag: str) -> str:
    return f"{{{ns}}}{tag}"


def w(tag: str) -> str:
    return q(W_NS, tag)


def make_run(
    text: str,
    *,
    bold: bool = False,
    italic: bool = False,
    size: int | None = None,
    color: str | None = None,
    font: str | None = None,
    preserve: bool = False,
) -> ET.Element:
    run = ET.Element(w("r"))
    if bold or italic or size is not None or color is not None or font is not None:
        rpr = ET.SubElement(run, w("rPr"))
        if bold:
            ET.SubElement(rpr, w("b"))
        if italic:
            ET.SubElement(rpr, w("i"))
        if font is not None:
            ET.SubElement(
                rpr,
                w("rFonts"),
                {
                    w("ascii"): font,
                    w("hAnsi"): font,
                    w("cs"): font,
                    w("eastAsia"): font,
                },
            )
        if size is not None:
            ET.SubElement(rpr, w("sz"), {w("val"): str(size)})
            ET.SubElement(rpr, w("szCs"), {w("val"): str(size)})
        if color is not None:
            ET.SubElement(rpr, w("color"), {w("val"): color})
    t = ET.SubElement(run, w("t"))
    if preserve or text.startswith(" ") or text.endswith(" ") or "\n" in text:
        t.set(q(XML_NS, "space"), "preserve")
    t.text = text
    return run


def make_paragraph(
    runs: list[ET.Element] | None = None,
    *,
    style: str | None = None,
    align: str | None = None,
    space_before: int | None = None,
    space_after: int | None = None,
    left: int | None = None,
    hanging: int | None = None,
    keep_next: bool = False,
) -> ET.Element:
    p = ET.Element(w("p"))
    ppr = ET.SubElement(p, w("pPr"))
    if style is not None:
        ET.SubElement(ppr, w("pStyle"), {w("val"): style})
    if align is not None:
        ET.SubElement(ppr, w("jc"), {w("val"): align})
    if keep_next:
        ET.SubElement(ppr, w("keepNext"))
    spacing_attrs: dict[str, str] = {}
    if space_before is not None:
        spacing_attrs[w("before")] = str(space_before)
    if space_after is not None:
        spacing_attrs[w("after")] = str(space_after)
    if spacing_attrs:
        ET.SubElement(ppr, w("spacing"), spacing_attrs)
    ind_attrs: dict[str, str] = {}
    if left is not None:
        ind_attrs[w("left")] = str(left)
    if hanging is not None:
        ind_attrs[w("hanging")] = str(hanging)
    if ind_attrs:
        ET.SubElement(ppr, w("ind"), ind_attrs)
    if runs:
        for run in runs:
            p.append(run)
    return p


def make_heading(text: str, level: int) -> ET.Element:
    if level == 0:
        size = 48
        after = 180
    elif level == 1:
        size = 32
        after = 120
    elif level == 2:
        size = 26
        after = 80
    else:
        size = 24
        after = 60
    return make_paragraph(
        [make_run(text, bold=True, size=size, font="Arial", color="0F172A")],
        style=f"Heading{min(level, 3)}" if level else "Title",
        space_before=240 if level else 0,
        space_after=after,
        keep_next=True,
    )


def make_bullet(text: str) -> ET.Element:
    return make_paragraph(
        [make_run(f"• {text}", size=22, font="Arial", color="0F172A")],
        style="ListParagraph",
        left=360,
        hanging=180,
        space_after=60,
    )


def set_cell_margins(tcpr: ET.Element, top: int = 120, bottom: int = 120, left: int = 160, right: int = 160) -> None:
    tc_mar = ET.SubElement(tcpr, w("tcMar"))
    for side, value in (("top", top), ("bottom", bottom), ("left", left), ("right", right)):
        ET.SubElement(tc_mar, w(side), {w("w"): str(value), w("type"): "dxa"})


def set_cell_shading(tcpr: ET.Element, fill: str) -> None:
    ET.SubElement(tcpr, w("shd"), {w("fill"): fill})


def set_table_borders(tblpr: ET.Element, color: str = "C9D1D9", size: str = "8") -> None:
    borders = ET.SubElement(tblpr, w("tblBorders"))
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        ET.SubElement(
            borders,
            w(side),
            {
                w("val"): "single",
                w("sz"): size,
                w("space"): "0",
                w("color"): color,
            },
        )


def make_table(headers: list[str], rows: list[list[str]], widths: list[int]) -> ET.Element:
    tbl = ET.Element(w("tbl"))
    tblpr = ET.SubElement(tbl, w("tblPr"))
    ET.SubElement(tblpr, w("tblW"), {w("w"): "0", w("type"): "auto"})
    set_table_borders(tblpr)
    tblgrid = ET.SubElement(tbl, w("tblGrid"))
    for width in widths:
        ET.SubElement(tblgrid, w("gridCol"), {w("w"): str(width)})

    def add_row(values: list[str], header: bool = False) -> None:
        tr = ET.SubElement(tbl, w("tr"))
        for idx, value in enumerate(values):
            tc = ET.SubElement(tr, w("tc"))
            tcpr = ET.SubElement(tc, w("tcPr"))
            set_cell_margins(tcpr, top=90 if header else 70, bottom=90 if header else 70, left=120, right=120)
            set_cell_shading(tcpr, "E2E8F0" if header else "FFFFFF")
            ET.SubElement(tcpr, w("tcW"), {w("w"): str(widths[min(idx, len(widths) - 1)]), w("type"): "dxa"})
            tc.append(
                make_paragraph(
                    [
                        make_run(
                            value,
                            bold=header,
                            size=20 if header else 19,
                            font="Arial",
                            color="0F172A",
                        )
                    ],
                    space_before=0,
                    space_after=0,
                )
            )

    add_row(headers, header=True)
    for row in rows:
        add_row(row, header=False)
    return tbl


def make_code_box(text: str, caption: str | None = None) -> list[ET.Element]:
    elements: list[ET.Element] = []
    if caption:
        elements.append(
            make_paragraph(
                [make_run(f"Diagram / Code: {caption}", bold=True, size=19, font="Arial", color="475569")],
                space_before=120,
                space_after=40,
            )
        )

    tbl = ET.Element(w("tbl"))
    tblpr = ET.SubElement(tbl, w("tblPr"))
    ET.SubElement(tblpr, w("tblW"), {w("w"): str(CONTENT_WIDTH_TWIPS), w("type"): "dxa"})
    set_table_borders(tblpr, color="CBD5E1", size="10")
    tblgrid = ET.SubElement(tbl, w("tblGrid"))
    ET.SubElement(tblgrid, w("gridCol"), {w("w"): str(CONTENT_WIDTH_TWIPS)})

    tr = ET.SubElement(tbl, w("tr"))
    tc = ET.SubElement(tr, w("tc"))
    tcpr = ET.SubElement(tc, w("tcPr"))
    set_cell_shading(tcpr, "F8FAFC")
    set_cell_margins(tcpr, top=120, bottom=120, left=150, right=150)
    ET.SubElement(tcpr, w("tcW"), {w("w"): str(CONTENT_WIDTH_TWIPS), w("type"): "dxa"})

    for line in text.strip("\n").splitlines():
        if line:
            tc.append(
                make_paragraph(
                    [make_run(line, size=17, font="Consolas", color="0F172A", preserve=True)],
                    space_before=0,
                    space_after=0,
                )
            )
        else:
            tc.append(make_paragraph(space_before=0, space_after=0))

    elements.append(tbl)
    elements.append(make_paragraph(space_before=0, space_after=70))
    return elements


def make_metadata_line(label: str, value: str) -> ET.Element:
    return make_paragraph(
        [
            make_run(label, bold=True, size=20, font="Arial", color="1E293B"),
            make_run(value, size=20, font="Arial", color="0F172A"),
        ],
        style="Normal",
        space_after=40,
    )


def build_document_body() -> list[ET.Element]:
    body: list[ET.Element] = []

    body.append(make_heading("Product Requirements Document (PRD): See", 0))
    body.append(make_metadata_line("Project Name: ", "See"))
    body.append(make_metadata_line("Platform: ", "Mobile (iOS & Android via React Native / Expo)"))
    body.append(make_metadata_line("Backend Core: ", "FastAPI (Python 3.12+), PostgreSQL (Supabase), Redis, Celery"))
    body.append(make_metadata_line("Auth Provider: ", "Supabase Auth (Google Sign-In)"))
    body.append(make_metadata_line("Document Version: ", "1.0.0 (Production Blueprint)"))

    body.append(make_heading("1. Executive Summary & Problem Statement", 1))
    body.append(
        make_paragraph(
            [
                make_run(
                    "Developers, technical students, and active candidates manage fragmented workflows across disparate tools: internship and job applications scattered across email threads and portals, local tech meetups dispersed across platforms like Devpost and Eventbrite without regional centralization, and technical cheat sheets lost in general-purpose note apps. Manual recording introduces high friction, resulting in missed deadlines and dropped opportunities.",
                    size=22,
                    font="Arial",
                )
            ],
            space_after=90,
        )
    )
    body.append(
        make_paragraph(
            [
                make_run(
                    "See is a unified personal developer workspace engineered for zero-friction manual capture and continuous background automation. It pairs active organization (Kanban pipeline, markdown notes, global quick-add) with passive ingestion (automated inbound email parsing via LLM, background event scrapers) inside a fast, offline-tolerant mobile interface.",
                    size=22,
                    font="Arial",
                )
            ],
            space_after=90,
        )
    )

    body.append(make_heading("2. User Personas & Core Workflows", 1))
    body.append(
        make_paragraph(
            [
                make_run(
                    "Target User: An active tech applicant juggling job boards, interview rounds, hackathons, and technical preparation.",
                    size=22,
                    font="Arial",
                )
            ],
            space_after=60,
        )
    )
    body.extend(
        make_code_box(
            """flowchart TD
    subgraph Capture["1. Quick Capture"]
        A[Tap Persistent FAB / Quick-Add] --> B{Select Type}
        B -->|Job| C[Log Company, Role, Deadline]
        B -->|Note| D[Save Markdown Cheat Sheet]
        B -->|Reminder| E[Set Timed Alert]
    end

    subgraph Automation["2. Inbound Automation"]
        F[Recruiter / ATS Email] --> G[Forwarded to Mail Ingestion Webhook]
        G --> H[FastAPI Webhook Enqueues to Redis]
        H --> I[Celery Worker + LLM Parses Details]
        I --> J[(PostgreSQL: Update Job Record)]
    end

    subgraph Daily["3. Morning Triage"]
        K[Open See App] --> L[Action Center Today View]
        L --> M[View Tasks Due Within 48 Hours]
        L --> N[Review Today's Interviews & Meetups]
    end""",
            "User Interaction & Workflow Architecture (Mermaid)",
        )
    )

    body.append(make_heading("3. System Architecture", 1))
    body.append(
        make_paragraph(
            [
                make_run(
                    "The architecture decouples the mobile user experience from asynchronous, heavy background tasks. FastAPI serves stateless JSON responses while Celery handles background LLM parsing and scraping.",
                    size=22,
                    font="Arial",
                )
            ],
            space_after=60,
        )
    )
    body.extend(
        make_code_box(
            """flowchart TB
    subgraph Client["Client Tier (Mobile)"]
        A[React Native / Expo App]
        B[expo-secure-store: JWT Storage]
        C[TanStack Query + Offline Cache]
        A --- B
        A --- C
    end

    subgraph Edge["Security & Gateway Tier"]
        D[Cloudflare / Nginx Reverse Proxy]
        E[Rate Limiter & SSL Termination]
        D --- E
    end

    subgraph API["Backend Tier (FastAPI)"]
        F[FastAPI Stateless Async Server]
        G[Supabase JWT Signature Validator]
        H[Route Controllers: Jobs, Notes, Events, Webhooks]
        F --- G
        F --- H
    end

    subgraph DataQueue["Data & Async Processing Tier"]
        I[(PostgreSQL / Supabase)]
        J[(Redis Cache & Message Broker)]
        K[Celery Worker Cluster]
        L[Devpost & Eventbrite Scrapers]
        M[LLM Email Extractor]

        K --> L
        K --> M
        J --> K
    end

    A -->|HTTPS / Bearer JWT| D
    D --> F
    F -->|Reads / Writes| I
    F -->|Cache Check & Enqueue| J
    M -->|Upsert Structured Records| I""",
            "Complete System Data Flow (Mermaid)",
        )
    )

    body.append(make_heading("4. Detailed Feature Specifications", 1))
    body.append(make_heading("Module 1: Universal Quick-Add & Action Center", 2))
    body.append(
        make_bullet(
            "Universal Quick-Add Sheet: Slide-up modal drawer accessible globally via a persistent floating button. Allows logging a Job, Note, or Reminder in under 5 seconds with optimistic local UI updates."
        )
    )
    body.append(
        make_bullet(
            "Action Center (Today View): High-priority screen displaying deadlines and interviews due in <= 48 hours, active preparation checklists, and pipeline summary badges."
        )
    )

    body.append(make_heading("Module 2: Job Application Pipeline", 2))
    body.append(make_bullet("Progression Stages: Bookmarked -> Applied -> Interviewing -> Offer -> Rejected / Archived."))
    body.append(
        make_bullet(
            "Metadata & Checklists: Detailed records for compensation, location, job URL, customized preparation subtasks, and interview debrief notes."
        )
    )

    body.append(make_heading("Module 3: Inbound Email Parsing Automation", 2))
    body.append(
        make_paragraph(
            [
                make_run(
                    "Incoming emails forwarded from mail relays hit a dedicated webhook. The webhook validates signatures, queues the task, and frees the connection in <50ms while Celery and an LLM process the email body.",
                    size=22,
                    font="Arial",
                )
            ],
            space_after=60,
        )
    )
    body.extend(
        make_code_box(
            """sequenceDiagram
    autonumber
    participant Mail as Inbound Mail Relay (e.g., Mailgun)
    participant API as FastAPI (POST /api/v1/webhooks/email)
    participant Queue as Redis / Celery
    participant LLM as LLM Engine (Claude / OpenAI)
    participant DB as PostgreSQL (Supabase)

    Mail->>API: HTTP POST (Raw Email Payload + HMAC)
    API->>API: Verify HMAC-SHA256 signature (<5ms)
    API->>Queue: Push raw email task to Redis
    API-->>Mail: 202 Accepted (<50ms)
    Queue->>LLM: Pass sanitized text within structural tags
    LLM-->>Queue: Return structured JSON (Company, Role, Status)
    Queue->>DB: Match company name & upsert job record""",
            "Email Webhook Ingestion Sequence (Mermaid)",
        )
    )

    body.append(make_heading("Module 4: Event Discovery & Calendar Aggregation", 2))
    body.append(make_bullet("Devpost Aggregator: Scheduled daily worker scraping upcoming hackathons (deadlines, prize pools, submission URLs)."))
    body.append(make_bullet("Regional Meetups: Ingestion from Eventbrite/Meetup APIs for local developer meetups."))
    body.append(make_bullet("Native Calendar Export: Direct synchronization with iOS/Android calendar via expo-calendar."))

    body.append(make_heading("Module 5: Knowledge Vault (Notes & Snippets)", 2))
    body.append(
        make_paragraph(
            [
                make_run(
                    "Markdown syntax support, tag taxonomies, and sub-50ms full-text search backed by PostgreSQL tsvector and GIN indexing.",
                    size=22,
                    font="Arial",
                )
            ],
            space_after=60,
        )
    )

    body.append(make_heading("Module 6: Identity & Authentication", 2))
    body.append(
        make_paragraph(
            [
                make_run(
                    "Google Sign-In managed through Supabase Auth. Session tokens stored exclusively in hardware keystores (expo-secure-store). FastAPI verifies JWT signatures statelessly.",
                    size=22,
                    font="Arial",
                )
            ],
            space_after=60,
        )
    )

    body.append(make_heading("5. Database Schema & Data Models", 1))
    body.extend(
        make_code_box(
            """erDiagram
    USERS ||--o{ JOB_APPLICATIONS : owns
    USERS ||--o{ NOTES : owns
    USERS ||--o{ REMINDERS : owns
    JOB_APPLICATIONS ||--o{ JOB_CHECKLISTS : contains

    USERS {
        uuid id PK
        string email
    }
    JOB_APPLICATIONS {
        uuid id PK
        uuid user_id FK
        string company
        string role
        string status
        timestamptz deadline
    }
    JOB_CHECKLISTS {
        uuid id PK
        uuid job_id FK
        string title
        boolean is_completed
    }
    NOTES {
        uuid id PK
        uuid user_id FK
        string title
        text content
        tsvector search_vector
    }
    REMINDERS {
        uuid id PK
        uuid user_id FK
        string title
        timestamptz due_date
        string priority
    }""",
            "Entity-Relationship Model (Mermaid)",
        )
    )
    body.extend(
        make_code_box(
            """-- Extensions & Enums
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TYPE job_status AS ENUM ('bookmarked', 'applied', 'interviewing', 'offer', 'rejected');
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high');

-- 1. Job Applications Table
CREATE TABLE job_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    company VARCHAR(150) NOT NULL,
    role VARCHAR(150) NOT NULL,
    location VARCHAR(150),
    salary_range VARCHAR(100),
    job_url TEXT,
    status job_status NOT NULL DEFAULT 'applied',
    interview_notes TEXT,
    deadline TIMESTAMPTZ,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_jobs_user_status ON job_applications(user_id, status);
CREATE INDEX idx_jobs_deadline ON job_applications(user_id, deadline);

-- 2. Job Checklists Table
CREATE TABLE job_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Notes Table with Generated Search Vector
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    tags VARCHAR(255),
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(tags, ''))
    ) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notes_user ON notes(user_id);
CREATE INDEX idx_notes_search ON notes USING GIN(search_vector);

-- 4. Reminders Table
CREATE TABLE reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    priority priority_level NOT NULL DEFAULT 'medium',
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_reminders_user_due ON reminders(user_id, due_date, is_completed);

-- 5. Scraped Events Catalog
CREATE TABLE scraped_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source VARCHAR(50) NOT NULL,
    external_id VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    location VARCHAR(255),
    is_virtual BOOLEAN DEFAULT TRUE,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    scraped_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_events_start ON scraped_events(start_date);""",
            "PostgreSQL Production DDL (SQL)",
        )
    )

    body.append(make_heading("6. API Interface Contract", 1))
    body.append(
        make_paragraph(
            [make_run("All endpoints (excluding inbound webhooks) require: Authorization: Bearer <SUPABASE_JWT>", size=22, font="Arial")],
            space_after=60,
        )
    )
    body.append(
        make_table(
            ["Endpoint", "Method", "Payload / Params", "Description"],
            [
                ["/api/v1/dashboard/today", "GET", "None", "Returns urgent jobs & reminders due in <= 48h"],
                ["/api/v1/quick-add", "POST", "{type, title, data}", "Unified rapid capture dispatcher"],
                ["/api/v1/jobs", "GET", "?status=applied&limit=20", "Filtered list of applications"],
                ["/api/v1/jobs", "POST", "JobCreateSchema", "Creates new application manually"],
                ["/api/v1/jobs/{id}", "PATCH", "JobUpdateSchema", "Updates stage, notes, or deadlines"],
                ["/api/v1/events", "GET", "?is_virtual=true", "Aggregated tech event catalog"],
                ["/api/v1/notes", "GET", "?q=search_term", "Full-text note search using tsvector"],
                ["/api/v1/notes", "POST", "{title, content, tags}", "Creates a markdown note card"],
                ["/api/v1/webhooks/email", "POST", "Raw Email Payload", "Enqueues email to Celery queue (202 Accepted)"],
            ],
            [2400, 1000, 2500, 4180],
        )
    )

    body.append(make_heading("7. Non-Functional Requirements (NFRs)", 1))
    body.append(
        make_table(
            ["Metric / Category", "Target", "Technical Mechanism"],
            [
                ["Read Latency (P95)", "<= 50 ms", "Redis cache for high-frequency reads; asyncpg connection pool"],
                ["Write Latency (P95)", "<= 150 ms", "Direct asynchronous PostgreSQL transactions"],
                ["Webhook Response", "<= 100 ms", "Pushes payload to Redis queue and returns 202 Accepted immediately"],
                ["Async Extraction SLA", "<= 10 sec", "Celery worker parses email via LLM and writes to PostgreSQL"],
                ["Token Security", "Zero Plaintext", "Hardware keystores (expo-secure-store); AsyncStorage strictly banned"],
                ["Webhook Security", "HMAC Validation", "HMAC-SHA256 signature verification enforced on all inbound webhooks"],
            ],
            [2400, 1600, 6080],
        )
    )

    body.append(make_heading("8. Phased Implementation Roadmap", 1))
    body.extend(
        make_code_box(
            """gantt
    title See: Implementation Roadmap
    dateFormat  YYYY-MM-DD
    section Phase 1: Foundation
    FastAPI + SQLAlchemy Scaffolding   :p1_1, 2026-09-07, 7d
    Supabase Auth & JWT Verification    :p1_2, after p1_1, 5d
    Expo App Shell & Quick-Add Sheet    :p1_3, after p1_2, 7d
    section Phase 2: Core Modules
    Job Pipeline Screens & CRUD         :p2_1, after p1_3, 8d
    Knowledge Vault (Markdown & Search) :p2_2, after p2_1, 6d
    Action Center (Today View)          :p2_3, after p2_2, 5d
    section Phase 3: Automation
    Redis & Celery Task Worker Setup    :p3_1, after p2_3, 5d
    Email Webhook & LLM Extraction      :p3_2, after p3_1, 8d
    Devpost & Eventbrite Web Scrapers   :p3_3, after p3_2, 7d
    section Phase 4: Polish
    Local Notifications (Expo)          :p4_1, after p3_3, 4d
    Offline SQLite Sync (TanStack)      :p4_2, after p4_1, 6d""",
            "Delivery Timeline (Mermaid Gantt)",
        )
    )

    return body


def make_core_props() -> bytes:
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    root = ET.Element(q(CP_NS, "coreProperties"))
    ET.SubElement(root, q(DC_NS, "title")).text = "Product Requirements Document (PRD): See"
    ET.SubElement(root, q(DC_NS, "subject")).text = "See PRD"
    ET.SubElement(root, q(DC_NS, "creator")).text = "Codex"
    ET.SubElement(root, q(DC_NS, "description")).text = "Product requirements document for the See application."
    ET.SubElement(root, q(CP_NS, "lastModifiedBy")).text = "Codex"
    ET.SubElement(root, q(CP_NS, "revision")).text = "1"
    ET.SubElement(root, q(DCTERMS_NS, "created"), {q(XSI_NS, "type"): "dcterms:W3CDTF"}).text = now
    ET.SubElement(root, q(DCTERMS_NS, "modified"), {q(XSI_NS, "type"): "dcterms:W3CDTF"}).text = now
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def make_app_props() -> bytes:
    root = ET.Element(q(EXT_PROP_NS, "Properties"))

    def add(name: str, value: str) -> None:
        ET.SubElement(root, q(EXT_PROP_NS, name)).text = value

    add("Application", "Codex")
    add("DocSecurity", "0")
    add("ScaleCrop", "false")

    heading_pairs = ET.SubElement(root, q(EXT_PROP_NS, "HeadingPairs"))
    vector = ET.SubElement(heading_pairs, q(VT_NS, "vector"), {"size": "2", "baseType": "variant"})
    variant1 = ET.SubElement(vector, q(VT_NS, "variant"))
    ET.SubElement(variant1, q(VT_NS, "lpstr")).text = "Document"
    variant2 = ET.SubElement(vector, q(VT_NS, "variant"))
    ET.SubElement(variant2, q(VT_NS, "i4")).text = "1"

    titles = ET.SubElement(root, q(EXT_PROP_NS, "TitlesOfParts"))
    vector2 = ET.SubElement(titles, q(VT_NS, "vector"), {"size": "1", "baseType": "lpstr"})
    ET.SubElement(vector2, q(VT_NS, "lpstr")).text = "See PRD"

    add("Company", "")
    add("LinksUpToDate", "false")
    add("SharedDoc", "false")
    add("HyperlinksChanged", "false")
    add("AppVersion", "16.0000")
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def make_content_types() -> bytes:
    root = ET.Element(q(CT_NS, "Types"))
    ET.SubElement(root, q(CT_NS, "Default"), {"Extension": "rels", "ContentType": "application/vnd.openxmlformats-package.relationships+xml"})
    ET.SubElement(root, q(CT_NS, "Default"), {"Extension": "xml", "ContentType": "application/xml"})
    ET.SubElement(root, q(CT_NS, "Override"), {"PartName": "/word/document.xml", "ContentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"})
    ET.SubElement(root, q(CT_NS, "Override"), {"PartName": "/docProps/core.xml", "ContentType": "application/vnd.openxmlformats-package.core-properties+xml"})
    ET.SubElement(root, q(CT_NS, "Override"), {"PartName": "/docProps/app.xml", "ContentType": "application/vnd.openxmlformats-officedocument.extended-properties+xml"})
    ET.SubElement(root, q(CT_NS, "Override"), {"PartName": "/word/styles.xml", "ContentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"})
    ET.SubElement(root, q(CT_NS, "Override"), {"PartName": "/word/settings.xml", "ContentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"})
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def make_relationships() -> bytes:
    root = ET.Element(q(PKG_REL_NS, "Relationships"))
    ET.SubElement(
        root,
        q(PKG_REL_NS, "Relationship"),
        {
            "Id": "rId1",
            "Type": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
            "Target": "word/document.xml",
        },
    )
    ET.SubElement(
        root,
        q(PKG_REL_NS, "Relationship"),
        {
            "Id": "rId2",
            "Type": "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties",
            "Target": "docProps/core.xml",
        },
    )
    ET.SubElement(
        root,
        q(PKG_REL_NS, "Relationship"),
        {
            "Id": "rId3",
            "Type": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties",
            "Target": "docProps/app.xml",
        },
    )
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def make_document_relationships() -> bytes:
    root = ET.Element(q(PKG_REL_NS, "Relationships"))
    rels = [
        ("rId1", "styles.xml", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"),
        ("rId2", "settings.xml", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings"),
    ]
    for rel_id, target, rel_type in rels:
        ET.SubElement(root, q(PKG_REL_NS, "Relationship"), {"Id": rel_id, "Type": rel_type, "Target": target})
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def make_styles_xml() -> bytes:
    root = ET.Element(w("styles"))

    def paragraph_style(style_id: str, name: str, *, based_on: str | None = "Normal", next_style: str | None = None, size: int | None = None, bold: bool = False, color: str | None = None, outline_lvl: int | None = None) -> None:
        style = ET.SubElement(root, w("style"), {w("type"): "paragraph", w("styleId"): style_id})
        ET.SubElement(style, w("name"), {w("val"): name})
        if based_on:
            ET.SubElement(style, w("basedOn"), {w("val"): based_on})
        if next_style:
            ET.SubElement(style, w("next"), {w("val"): next_style})
        qformat = ET.SubElement(style, w("qFormat"))
        if size is not None or bold or color is not None:
            rpr = ET.SubElement(style, w("rPr"))
            if bold:
                ET.SubElement(rpr, w("b"))
            if size is not None:
                ET.SubElement(rpr, w("sz"), {w("val"): str(size)})
                ET.SubElement(rpr, w("szCs"), {w("val"): str(size)})
            if color is not None:
                ET.SubElement(rpr, w("color"), {w("val"): color})
        if outline_lvl is not None:
            ppr = ET.SubElement(style, w("pPr"))
            ET.SubElement(ppr, w("outlineLvl"), {w("val"): str(outline_lvl)})

    normal = ET.SubElement(root, w("style"), {w("type"): "paragraph", w("default"): "1", w("styleId"): "Normal"})
    ET.SubElement(normal, w("name"), {w("val"): "Normal"})
    ET.SubElement(normal, w("qFormat"))
    ET.SubElement(normal, w("rsid"), {w("val"): "00000000"})
    ET.SubElement(normal, w("rPr"))

    paragraph_style("Title", "Title", based_on="Normal", next_style="Normal", size=48, bold=True, color="0F172A")
    paragraph_style("Heading1", "heading 1", based_on="Normal", next_style="Normal", size=32, bold=True, color="0F172A", outline_lvl=0)
    paragraph_style("Heading2", "heading 2", based_on="Normal", next_style="Normal", size=26, bold=True, color="0F172A", outline_lvl=1)
    paragraph_style("Heading3", "heading 3", based_on="Normal", next_style="Normal", size=24, bold=True, color="0F172A", outline_lvl=2)

    list_style = ET.SubElement(root, w("style"), {w("type"): "paragraph", w("styleId"): "ListParagraph"})
    ET.SubElement(list_style, w("name"), {w("val"): "List Paragraph"})
    ET.SubElement(list_style, w("basedOn"), {w("val"): "Normal"})
    ET.SubElement(list_style, w("qFormat"))
    ppr = ET.SubElement(list_style, w("pPr"))
    ET.SubElement(ppr, w("ind"), {w("left"): "360", w("hanging"): "180"})

    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def make_settings_xml() -> bytes:
    root = ET.Element(w("settings"))
    ET.SubElement(root, w("zoom"), {w("percent"): "100"})
    ET.SubElement(root, w("defaultTabStop"), {w("val"): "720"})
    ET.SubElement(root, w("characterSpacingControl"), {w("val"): "doNotCompress"})
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def make_document_xml() -> bytes:
    document = ET.Element(w("document"))
    body = ET.SubElement(document, w("body"))
    for element in build_document_body():
        body.append(element)

    sect_pr = ET.SubElement(body, w("sectPr"))
    ET.SubElement(
        sect_pr,
        w("pgSz"),
        {
            w("w"): str(PAGE_WIDTH_TWIPS),
            w("h"): str(PAGE_HEIGHT_TWIPS),
        },
    )
    ET.SubElement(
        sect_pr,
        w("pgMar"),
        {
            w("top"): str(PAGE_MARGIN_TWIPS),
            w("right"): str(PAGE_MARGIN_TWIPS),
            w("bottom"): str(PAGE_MARGIN_TWIPS),
            w("left"): str(PAGE_MARGIN_TWIPS),
            w("header"): "720",
            w("footer"): "720",
            w("gutter"): "0",
        },
    )
    ET.SubElement(sect_pr, w("cols"), {w("space"): "720"})
    ET.SubElement(sect_pr, w("docGrid"), {w("linePitch"): "360"})
    return ET.tostring(document, encoding="utf-8", xml_declaration=True)


def write_docx(path: Path) -> None:
    parts = {
        "[Content_Types].xml": make_content_types(),
        "_rels/.rels": make_relationships(),
        "docProps/core.xml": make_core_props(),
        "docProps/app.xml": make_app_props(),
        "word/_rels/document.xml.rels": make_document_relationships(),
        "word/document.xml": make_document_xml(),
        "word/styles.xml": make_styles_xml(),
        "word/settings.xml": make_settings_xml(),
    }

    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name, data in parts.items():
            zf.writestr(name, data)


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    if HTML_PATH.exists():
        HTML_PATH.unlink()
    if DOCX_PATH.exists():
        DOCX_PATH.unlink()
    write_docx(DOCX_PATH)
    print(f"Document successfully created: {DOCX_PATH}")


if __name__ == "__main__":
    main()
