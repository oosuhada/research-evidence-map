from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api.app.ai import _classify, classify_baseline
from evaluation.evidence_classification_eval import load_cases, score


def test_candidate_classifier_improves_curated_evidence_routing() -> None:
    cases = load_cases()
    baseline = score(classify_baseline, cases)
    candidate = score(_classify, cases)
    assert candidate["accuracy"] > baseline["accuracy"]
    assert candidate["accuracy"] >= 0.9
