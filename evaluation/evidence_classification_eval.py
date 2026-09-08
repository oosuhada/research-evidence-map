from __future__ import annotations

import json
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api.app.ai import _classify, classify_baseline

EVALUATION_DIR = Path(__file__).resolve().parent
DATASET = EVALUATION_DIR / "evidence-classification-cases.jsonl"


def load_cases() -> list[dict[str, str]]:
    return [json.loads(line) for line in DATASET.read_text(encoding="utf-8").splitlines() if line.strip()]


def score(classifier, cases: list[dict[str, str]]) -> dict[str, object]:
    failures: list[dict[str, str]] = []
    confusion: Counter[str] = Counter()
    for case in cases:
        _, predicted = classifier(case["text"])
        expected = case["expected_cluster"]
        confusion[f"{expected} -> {predicted}"] += 1
        if predicted != expected:
            failures.append({"id": case["id"], "expected": expected, "predicted": predicted})
    return {
        "accuracy": round((len(cases) - len(failures)) / len(cases), 6),
        "correct": len(cases) - len(failures),
        "total": len(cases),
        "failures": failures,
        "confusion": dict(sorted(confusion.items())),
    }


def run() -> dict[str, object]:
    cases = load_cases()
    baseline = score(classify_baseline, cases)
    candidate = score(_classify, cases)
    repeat_hashes = [json.dumps(score(_classify, cases), sort_keys=True) for _ in range(3)]
    return {
        "experiment": "research-evidence-deterministic-classifier-v1",
        "question": "Does cue scoring reduce first-keyword routing errors without adding nondeterminism?",
        "git_sha": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dataset": {"path": "evaluation/evidence-classification-cases.jsonl", "cases": len(cases), "classes": 4},
        "baseline": baseline,
        "candidate": candidate,
        "repeated_runs": 3,
        "deterministic_repeat_match": len(set(repeat_hashes)) == 1,
        "failure_taxonomy": ["trust/provenance ambiguity", "workflow-friction ambiguity", "job/need ambiguity", "contradiction cue"],
        "limitations": [
            "The labeled fixture is small and curated from product-research language; it is not a blinded human annotation study.",
            "This evaluates deterministic routing only, not external LLM extraction factuality.",
            "Provider output still requires separate schema/evidence-grounding evaluation when external models are enabled.",
        ],
    }


if __name__ == "__main__":
    result = run()
    path = EVALUATION_DIR / "results/evidence-classification-v1.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2, sort_keys=True))
