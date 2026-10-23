import sqlite3
from uuid import UUID

import pytest
from sqlalchemy import select
from sqlalchemy.dialects import sqlite

from app.api.v1.endpoints.notes import note_source_clause
from app.models.note import Note


@pytest.mark.parametrize(("source", "expected"), [("manual", ["own-note"]), ("email", ["imported-note"])])
def test_note_source_filter_uses_provenance_and_keeps_accounts_separate(source, expected):
    owner = UUID("11111111-1111-1111-1111-111111111111")
    with sqlite3.connect(":memory:") as db:
        db.execute("CREATE TABLE notes (id TEXT PRIMARY KEY, user_id TEXT)")
        db.execute("CREATE TABLE email_ingestions (id TEXT, linked_note_id TEXT)")
        db.executemany("INSERT INTO notes VALUES (?, ?)", [
            ("own-note", owner.hex), ("imported-note", owner.hex), ("other-user-note", "someone-else"),
        ])
        db.executemany("INSERT INTO email_ingestions VALUES (?, ?)", [
            ("email-1", "imported-note"), ("email-2", "other-user-note"),
        ])
        statement = select(Note.id).where(Note.user_id == owner, note_source_clause(source))
        sql = str(statement.compile(dialect=sqlite.dialect(), compile_kwargs={"literal_binds": True}))
        assert [row[0] for row in db.execute(sql)] == expected
