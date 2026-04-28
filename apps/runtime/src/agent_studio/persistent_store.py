from __future__ import annotations

import asyncio
import json
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Any

import psycopg
from langgraph.store.base import (
    GetOp,
    Item,
    ListNamespacesOp,
    Op,
    PutOp,
    Result,
    SearchItem,
    SearchOp,
)
from langgraph.store.memory import InMemoryStore
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb


def normalize_database_uri(uri: str) -> str:
    if uri.startswith("postgres://"):
        return "postgresql://" + uri.removeprefix("postgres://")
    return uri


class PostgresStore(InMemoryStore):
    """Small Postgres-backed LangGraph store for DeepAgents file memory.

    This first version only needs key-value memory/file operations, not semantic vector search.
    This store implements the BaseStore batch API that DeepAgents' StoreBackend uses
    for persistent `/memories` and `/artifacts` files.
    """

    def __init__(self, database_uri: str) -> None:
        super().__init__()
        self.database_uri = normalize_database_uri(database_uri)
        self._schema_ready = False

    def _connect(self) -> psycopg.Connection:
        return psycopg.connect(self.database_uri, row_factory=dict_row)

    def _ensure_schema(self) -> None:
        if self._schema_ready:
            return
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS studio_store (
                  namespace_key TEXT NOT NULL,
                  namespace JSONB NOT NULL,
                  key TEXT NOT NULL,
                  value JSONB NOT NULL,
                  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                  PRIMARY KEY (namespace_key, key)
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS studio_store_updated_at_idx
                ON studio_store (updated_at DESC)
                """
            )
            conn.commit()
        self._schema_ready = True

    @staticmethod
    def _namespace_key(namespace: tuple[str, ...]) -> str:
        return json.dumps(list(namespace), separators=(",", ":"))

    @staticmethod
    def _row_to_item(row: dict[str, Any]) -> Item:
        namespace = tuple(row["namespace"])
        return Item(
            namespace=namespace,
            key=row["key"],
            value=row["value"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    @staticmethod
    def _matches_prefix(namespace: tuple[str, ...], prefix: tuple[str, ...]) -> bool:
        return namespace[: len(prefix)] == prefix

    @staticmethod
    def _matches_filter(value: dict[str, Any], filter_value: dict[str, Any] | None) -> bool:
        if not filter_value:
            return True
        return all(value.get(key) == expected for key, expected in filter_value.items())

    @staticmethod
    def _matches_query(value: dict[str, Any], query: str | None) -> bool:
        if not query:
            return True
        return query.lower() in json.dumps(value, sort_keys=True).lower()

    def _all_items(self, conn: psycopg.Connection) -> list[Item]:
        rows = conn.execute(
            """
            SELECT namespace, key, value, created_at, updated_at
            FROM studio_store
            ORDER BY updated_at DESC, key ASC
            """
        ).fetchall()
        return [self._row_to_item(dict(row)) for row in rows]

    def _handle_put(self, conn: psycopg.Connection, op: PutOp) -> None:
        namespace_key = self._namespace_key(op.namespace)
        if op.value is None:
            conn.execute(
                "DELETE FROM studio_store WHERE namespace_key = %s AND key = %s",
                (namespace_key, op.key),
            )
            return

        conn.execute(
            """
            INSERT INTO studio_store (namespace_key, namespace, key, value)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (namespace_key, key)
            DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            """,
            (namespace_key, Jsonb(list(op.namespace)), op.key, Jsonb(op.value)),
        )

    def _handle_get(self, conn: psycopg.Connection, op: GetOp) -> Item | None:
        row = conn.execute(
            """
            SELECT namespace, key, value, created_at, updated_at
            FROM studio_store
            WHERE namespace_key = %s AND key = %s
            """,
            (self._namespace_key(op.namespace), op.key),
        ).fetchone()
        return self._row_to_item(dict(row)) if row else None

    def _handle_search(self, conn: psycopg.Connection, op: SearchOp) -> list[SearchItem]:
        items = [
            item
            for item in self._all_items(conn)
            if self._matches_prefix(item.namespace, op.namespace_prefix)
            and self._matches_filter(item.value, op.filter)
            and self._matches_query(item.value, op.query)
        ]
        page = items[op.offset : op.offset + op.limit]
        return [
            SearchItem(
                namespace=item.namespace,
                key=item.key,
                value=item.value,
                created_at=item.created_at,
                updated_at=item.updated_at,
            )
            for item in page
        ]

    def _handle_list_namespaces(self, conn: psycopg.Connection, op: ListNamespacesOp) -> list[tuple[str, ...]]:
        namespaces = {item.namespace for item in self._all_items(conn)}
        conditions = op.match_conditions or ()
        for condition in conditions:
            condition_path = tuple(condition.path)
            if condition.match_type == "prefix":
                namespaces = {namespace for namespace in namespaces if self._matches_prefix(namespace, condition_path)}
            elif condition.match_type == "suffix":
                namespaces = {namespace for namespace in namespaces if namespace[-len(condition_path) :] == condition_path}

        if op.max_depth is not None:
            namespaces = {namespace[: op.max_depth] for namespace in namespaces}

        return sorted(namespaces)[op.offset : op.offset + op.limit]

    def batch(self, ops: Iterable[Op]) -> list[Result]:
        self._ensure_schema()
        results: list[Result] = []
        with self._connect() as conn:
            for op in ops:
                if isinstance(op, PutOp):
                    self._handle_put(conn, op)
                    results.append(None)
                elif isinstance(op, GetOp):
                    results.append(self._handle_get(conn, op))
                elif isinstance(op, SearchOp):
                    results.append(self._handle_search(conn, op))
                elif isinstance(op, ListNamespacesOp):
                    results.append(self._handle_list_namespaces(conn, op))
                else:
                    raise NotImplementedError(f"Unsupported store operation: {type(op).__name__}")
            conn.commit()
        return results

    async def abatch(self, ops: Iterable[Op]) -> list[Result]:
        return await asyncio.to_thread(self.batch, list(ops))


def file_value(content: str, *, created_at: str | None = None) -> dict[str, Any]:
    now = datetime.now(UTC).isoformat()
    return {
        "content": content.split("\n"),
        "created_at": created_at or now,
        "modified_at": now,
    }
