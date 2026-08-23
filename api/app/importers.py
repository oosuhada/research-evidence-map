from __future__ import annotations

import csv
import io
import json
import re
from dataclasses import dataclass
from hashlib import sha256


SENSITIVE_PATTERNS = (
    re.compile(r"\b\d{6}-?[1-4]\d{6}\b"),
    re.compile(r"\b(?:\d[ -]*?){13,19}\b"),
    re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE),
    re.compile(r"\b01[016789]-?\d{3,4}-?\d{4}\b"),
)


@dataclass(frozen=True)
class FragmentDraft:
    ordinal: int
    text: str
    locator: str
    char_start: int
    char_end: int


def content_hash(text: str) -> str:
    return sha256(text.encode("utf-8")).hexdigest()


def contains_sensitive_data(text: str) -> bool:
    return any(pattern.search(text) for pattern in SENSITIVE_PATTERNS)


def normalize_content(name: str, text: str) -> str:
    lower = name.lower()
    if lower.endswith(".json"):
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            return text.strip()
        if isinstance(payload, list):
            rows = []
            for index, item in enumerate(payload, start=1):
                if isinstance(item, dict):
                    body = item.get("text") or item.get("body") or item.get("content") or json.dumps(item, ensure_ascii=False)
                else:
                    body = str(item)
                rows.append(f"[{index}] {body}")
            return "\n\n".join(rows)
        if isinstance(payload, dict):
            return "\n\n".join(f"{key}: {value}" for key, value in payload.items())
    if lower.endswith(".csv"):
        try:
            reader = csv.DictReader(io.StringIO(text))
            rows = []
            for index, row in enumerate(reader, start=1):
                preferred = row.get("text") or row.get("body") or row.get("content") or row.get("message")
                body = preferred or " · ".join(f"{key}: {value}" for key, value in row.items() if value)
                rows.append(f"[{index}] {body}")
            if rows:
                return "\n\n".join(rows)
        except (csv.Error, UnicodeError):
            pass
    return text.strip()


def fragment_text(text: str, max_chars: int = 900) -> list[FragmentDraft]:
    normalized = text.replace("\r\n", "\n").strip()
    if not normalized:
        return []
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", normalized) if part.strip()]
    chunks: list[tuple[str, int, int]] = []
    search_from = 0
    for paragraph in paragraphs:
        start = normalized.find(paragraph, search_from)
        if start < 0:
            start = search_from
        if len(paragraph) <= max_chars:
            chunks.append((paragraph, start, start + len(paragraph)))
        else:
            offset = 0
            while offset < len(paragraph):
                end = min(len(paragraph), offset + max_chars)
                if end < len(paragraph):
                    boundary = paragraph.rfind(" ", offset, end)
                    if boundary > offset + 300:
                        end = boundary
                piece = paragraph[offset:end].strip()
                if piece:
                    local_start = paragraph.find(piece, offset)
                    chunks.append((piece, start + local_start, start + local_start + len(piece)))
                offset = max(end, offset + 1)
        search_from = start + len(paragraph)
    return [
        FragmentDraft(index, body, f"¶{index + 1} · chars {start + 1}–{end}", start, end)
        for index, (body, start, end) in enumerate(chunks)
    ]


def preview_fragment_text(text: str, limit: int = 220) -> str:
    compact = re.sub(r"\s+", " ", text).strip()
    return compact if len(compact) <= limit else compact[: limit - 1] + "…"
