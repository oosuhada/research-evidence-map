from __future__ import annotations

import json
import re
import threading
import time
from collections import deque
from dataclasses import dataclass
from typing import Protocol
from urllib import error, request

from pydantic import BaseModel, Field, ValidationError

from .config import settings


_request_times: deque[float] = deque()
_rate_lock = threading.Lock()


class ExtractedEvidence(BaseModel):
    title: str = Field(min_length=1, max_length=220)
    body: str = Field(min_length=1)
    kind: str
    cluster: str


class ExtractionPayload(BaseModel):
    evidence: list[ExtractedEvidence]


@dataclass(frozen=True)
class AdapterMetadata:
    provider: str
    model: str
    prompt_version: str = "extract-v1"
    schema_version: str = "evidence-v1"


class AIAdapter(Protocol):
    metadata: AdapterMetadata

    def extract(self, text: str) -> ExtractionPayload: ...

    def challenge(self, opportunity: str, evidence: list[str]) -> str: ...


def _clean_title(text: str) -> str:
    compact = re.sub(r"\s+", " ", text).strip(" \t\n\"'“”")
    sentence = re.split(r"(?<=[.!?。！？])\s+", compact, maxsplit=1)[0]
    words = sentence.split()
    if len(words) > 13:
        sentence = " ".join(words[:13]) + "…"
    return sentence[:220] or "Customer evidence"


def _classify(text: str) -> tuple[str, str]:
    lower = text.lower()
    if any(token in lower for token in ("but ", "however", "반면", "하지만", "contradict", "disagree")):
        return "Contradiction", "Contradictions"
    if any(token in lower for token in ("want", "need", "trying to", "해야", "원하", "필요")):
        return "Job to Be Done", "Needs & jobs"
    if any(token in lower for token in ("trust", "source", "citation", "evidence", "근거", "출처", "신뢰")):
        return "Pain Point", "Trust & provenance"
    if any(token in lower for token in ("slow", "time", "friction", "귀찮", "느리", "시간")):
        return "Pain Point", "Workflow friction"
    return "Pain Point", "Unsorted signals"


class DeterministicAdapter:
    metadata = AdapterMetadata(provider="deterministic", model=settings.ai_model)

    def extract(self, text: str) -> ExtractionPayload:
        kind, cluster = _classify(text)
        compact = re.sub(r"\s+", " ", text).strip()
        return ExtractionPayload(
            evidence=[ExtractedEvidence(title=_clean_title(compact), body=compact, kind=kind, cluster=cluster)]
        )

    def challenge(self, opportunity: str, evidence: list[str]) -> str:
        weak = next((item for item in evidence if len(item) < 180), evidence[0] if evidence else "No supporting evidence is linked yet.")
        return (
            f"Challenge: treat “{opportunity}” as a hypothesis, not a conclusion. "
            f"The weakest linked signal is “{_clean_title(weak)}”. Look for a participant or channel that succeeds without this solution, "
            "then test whether the problem is frequent, costly, and currently unsolved before increasing commitment."
        )


class OpenAICompatibleAdapter:
    def __init__(self) -> None:
        if not settings.ai_api_key or not settings.ai_base_url:
            raise RuntimeError("AI provider is configured but SIGNAL_GARDEN_AI_API_KEY / SIGNAL_GARDEN_AI_BASE_URL is missing")
        self.metadata = AdapterMetadata(provider=settings.ai_provider, model=settings.ai_model)

    def _post(self, payload: dict) -> dict:
        now = time.monotonic()
        with _rate_lock:
            while _request_times and now - _request_times[0] >= 60:
                _request_times.popleft()
            if len(_request_times) >= settings.ai_rate_limit_per_minute:
                raise RuntimeError(
                    f"Local AI rate limit reached ({settings.ai_rate_limit_per_minute}/minute); retry after the current window"
                )
            _request_times.append(now)
        endpoint = settings.ai_base_url.rstrip("/") + "/chat/completions"
        body = json.dumps(payload).encode("utf-8")
        req = request.Request(
            endpoint,
            data=body,
            headers={"Authorization": f"Bearer {settings.ai_api_key}", "Content-Type": "application/json"},
            method="POST",
        )
        last_error: Exception | None = None
        for attempt in range(settings.ai_max_retries + 1):
            try:
                with request.urlopen(req, timeout=settings.ai_timeout_seconds) as response:
                    return json.loads(response.read().decode("utf-8"))
            except error.HTTPError as exc:
                last_error = exc
                if exc.code == 429 and attempt < settings.ai_max_retries:
                    try:
                        retry_after = float(exc.headers.get("Retry-After", "1"))
                    except ValueError:
                        retry_after = 1.0
                    time.sleep(min(max(retry_after, 0.1), 4.0))
                    continue
                if attempt < settings.ai_max_retries and 500 <= exc.code < 600:
                    time.sleep(min(2**attempt, 4))
                    continue
                break
            except (error.URLError, TimeoutError, json.JSONDecodeError) as exc:
                last_error = exc
                if attempt < settings.ai_max_retries:
                    time.sleep(min(2**attempt, 4))
        raise RuntimeError(f"AI request failed after retries: {last_error}")

    def extract(self, text: str) -> ExtractionPayload:
        payload = self._post({
            "model": settings.ai_model,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Return JSON only: {evidence:[{title,body,kind,cluster}]}. Extract one product-discovery evidence item. Never invent facts."},
                {"role": "user", "content": text},
            ],
        })
        try:
            content = payload["choices"][0]["message"]["content"]
            return ExtractionPayload.model_validate_json(content)
        except (KeyError, IndexError, TypeError, ValidationError) as exc:
            raise RuntimeError(f"Malformed provider output: {exc}") from exc

    def challenge(self, opportunity: str, evidence: list[str]) -> str:
        payload = self._post({
            "model": settings.ai_model,
            "temperature": 0,
            "messages": [
                {"role": "system", "content": "Challenge the product opportunity using only linked evidence. Identify missing disconfirming evidence in under 120 words."},
                {"role": "user", "content": json.dumps({"opportunity": opportunity, "evidence": evidence}, ensure_ascii=False)},
            ],
        })
        try:
            return str(payload["choices"][0]["message"]["content"]).strip()
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError(f"Malformed provider output: {exc}") from exc


def get_adapter() -> AIAdapter:
    if settings.ai_provider == "deterministic":
        return DeterministicAdapter()
    return OpenAICompatibleAdapter()
