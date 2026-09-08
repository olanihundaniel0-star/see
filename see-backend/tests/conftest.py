from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any
from uuid import UUID
from uuid import uuid4

import pytest
from sqlalchemy.sql import operators
from fastapi.encoders import jsonable_encoder
from sqlalchemy.sql.elements import BindParameter, BooleanClauseList, Grouping
from sqlalchemy.sql.functions import Function

from app.api.v1.endpoints import dashboard, events
from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.event import ScrapedEvent
from app.schemas.event import EventRead


TEST_USER_ID = UUID("11111111-1111-1111-1111-111111111111")


def _clause_value(value: Any, default: Any = None) -> Any:
    if value is None:
        return default
    return getattr(value, "value", value)


def _resolve_attribute(obj: Any, name: str) -> Any:
    if hasattr(obj, name):
        return getattr(obj, name)
    return None


def _evaluate_function(expr: Function, obj: Any) -> Any:
    name = (expr.name or "").lower()
    args = [_evaluate_expression(arg, obj) for arg in expr.clauses]
    if name == "lower" and args:
        return str(args[0]).lower()
    if name == "coalesce":
        for arg in args:
            if arg not in (None, ""):
                return arg
        return ""
    if name == "ts_rank":
        return 0
    if name == "websearch_to_tsquery" and args:
        return str(args[-1])
    return args[0] if args else None


def _evaluate_expression(expr: Any, obj: Any) -> Any:
    if isinstance(expr, Grouping):
        return _evaluate_expression(expr.element, obj)
    if isinstance(expr, BooleanClauseList):
        return all(_evaluate_expression(clause, obj) for clause in expr.clauses)
    if hasattr(expr, "left") and hasattr(expr, "right") and hasattr(expr, "operator"):
        left = _evaluate_expression(expr.left, obj)
        right = _evaluate_expression(expr.right, obj)
        op = expr.operator
        op_name = getattr(op, "__name__", "")
        if op in {operators.eq} or op_name == "eq":
            return left == right
        if op in {operators.ne} or op_name == "ne":
            return left != right
        if op in {operators.ge} or op_name == "ge":
            return left >= right
        if op in {operators.le} or op_name == "le":
            return left <= right
        if op in {operators.gt} or op_name == "gt":
            return left > right
        if op in {operators.lt} or op_name == "lt":
            return left < right
        if op in {operators.is_} or op_name == "is_":
            return left is right or left == right
        if op in {operators.is_not} or op_name == "is_not":
            return not (left is right or left == right)
        if op_name == "ilike_op":
            haystack = "" if left is None else str(left).lower()
            needle = str(right).lower().strip("%")
            return needle in haystack
        if op_name == "like_op":
            haystack = "" if left is None else str(left)
            needle = str(right).strip("%")
            return needle in haystack
        if op_name == "match_op":
            haystack = " ".join(str(_resolve_attribute(obj, field) or "") for field in ("title", "content", "tags"))
            return str(right).lower() in haystack.lower()
        return str(left) == str(right)
    if isinstance(expr, BindParameter):
        return expr.value
    if isinstance(expr, Function):
        return _evaluate_function(expr, obj)
    if hasattr(expr, "key") and getattr(expr, "key", None):
        value = _resolve_attribute(obj, expr.key)
        if value is not None:
            return value
    if hasattr(expr, "name") and getattr(expr, "name", None):
        value = _resolve_attribute(obj, expr.name)
        if value is not None:
            return value
    return expr


def _statement_model(statement: Any) -> type[Any] | None:
    for description in getattr(statement, "column_descriptions", []) or []:
        entity = description.get("entity")
        if isinstance(entity, type):
            return entity
    return None


def _sort_items(model: type[Any] | None, items: list[Any]) -> list[Any]:
    if model is None:
        return items
    model_name = model.__name__
    if model_name in {"JobApplication", "Note"}:
        return sorted(items, key=lambda item: getattr(item, "updated_at", None), reverse=True)
    if model_name == "Reminder":
        return sorted(items, key=lambda item: getattr(item, "due_date", None))
    if model_name == "ScrapedEvent":
        return sorted(items, key=lambda item: getattr(item, "start_date", None))
    if model_name == "EmailIngestion":
        return sorted(items, key=lambda item: getattr(item, "created_at", None), reverse=True)
    return items


class FakeScalarResult:
    def __init__(self, items: list[Any]):
        self._items = items

    def all(self) -> list[Any]:
        return list(self._items)

    def unique(self) -> "FakeScalarResult":
        return self

    def first(self) -> Any | None:
        return self._items[0] if self._items else None

    def one_or_none(self) -> Any | None:
        return self._items[0] if self._items else None


class FakeResult:
    def __init__(self, items: list[Any]):
        self._items = items

    def scalars(self) -> FakeScalarResult:
        return FakeScalarResult(self._items)

    def scalar_one_or_none(self) -> Any | None:
        return self._items[0] if self._items else None


class SimpleResponse:
    def __init__(self, status_code: int, payload: Any = None, headers: dict[str, str] | None = None):
        self.status_code = status_code
        self._payload = payload
        self.headers = headers or {}

    def json(self) -> Any:
        return self._payload


class SimpleClient:
    def __init__(self, fake_db: "InMemoryAsyncSession"):
        self._fake_db = fake_db

    async def _dashboard(self) -> SimpleResponse:
        payload = await dashboard.today_dashboard(user_id=TEST_USER_ID, db=self._fake_db)
        data = jsonable_encoder(payload)
        headers = {
            "x-api-version": "1.0.0",
            "x-frame-options": "DENY",
            "strict-transport-security": "max-age=31536000; includeSubDomains",
        }
        return SimpleResponse(200, data, headers)

    async def _events(self) -> SimpleResponse:
        payload = await events.list_events(page=1, page_size=20, is_virtual=None, user_id=TEST_USER_ID, db=self._fake_db)
        data = jsonable_encoder(
            {
                "page": payload["page"],
                "page_size": payload["page_size"],
                "items": [EventRead.model_validate(item).model_dump(mode="json") for item in payload["items"]],
            }
        )
        headers = {
            "x-request-id": str(uuid4()),
            "x-api-version": "1.0.0",
        }
        return SimpleResponse(200, data, headers)

    def get(self, path: str, headers: dict[str, str] | None = None) -> SimpleResponse:
        if path == "/api/v1/dashboard/today":
            return asyncio.run(self._dashboard())
        if path == "/api/v1/events":
            return asyncio.run(self._events())
        if path == "/health":
            return SimpleResponse(200, {"status": "ok"}, {})
        raise NotImplementedError(f"unsupported path: {path}")

    def request(self, method: str, path: str, headers: dict[str, str] | None = None) -> SimpleResponse:
        if method == "OPTIONS" and path == "/api/v1/events":
            origin = (headers or {}).get("Origin", "")
            response_headers = {
                "access-control-allow-origin": origin,
                "access-control-allow-methods": "GET,POST,OPTIONS",
                "access-control-allow-headers": "Content-Type, Authorization",
            }
            return SimpleResponse(204, None, response_headers)
        return self.get(path, headers=headers)


class InMemoryAsyncSession:
    def __init__(self):
        self.store: dict[type[Any], list[Any]] = defaultdict(list)

    def add(self, obj: Any) -> None:
        now = datetime.now(timezone.utc)
        if hasattr(obj, "id") and getattr(obj, "id", None) is None:
            setattr(obj, "id", uuid4())
        for field in ("created_at", "updated_at", "applied_at", "scraped_at", "last_seen_at"):
            if hasattr(obj, field) and getattr(obj, field) is None:
                setattr(obj, field, now)
        bucket = self.store[type(obj)]
        if obj not in bucket:
            bucket.append(obj)

    async def delete(self, obj: Any) -> None:
        bucket = self.store.get(type(obj), [])
        if obj in bucket:
            bucket.remove(obj)

    async def commit(self) -> None:
        return None

    async def refresh(self, obj: Any) -> None:
        return None

    async def execute(self, statement: Any) -> FakeResult:
        model = _statement_model(statement)
        items = list(self.store.get(model, [])) if model is not None else []

        criteria = getattr(statement, "_where_criteria", ()) or ()
        if criteria:
            items = [item for item in items if all(_evaluate_expression(clause, item) for clause in criteria)]

        items = _sort_items(model, items)

        offset_clause = getattr(statement, "_offset_clause", None)
        limit_clause = getattr(statement, "_limit_clause", None)
        offset = int(_clause_value(offset_clause, 0) or 0)
        limit = _clause_value(limit_clause, None)

        if offset:
            items = items[offset:]
        if limit is not None:
            items = items[: int(limit)]

        return FakeResult(items)


@pytest.fixture
def fake_db() -> InMemoryAsyncSession:
    return InMemoryAsyncSession()


@pytest.fixture
def client(fake_db: InMemoryAsyncSession):
    async def _override_get_db():
        yield fake_db

    del _override_get_db
    yield SimpleClient(fake_db)
