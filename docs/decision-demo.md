# Verification Tax → Decision Record Demo

This demo is intentionally structured around the market hypothesis that **AI analysis is fast, but verification and decision accountability remain manual**.

The central question is:

> **After AI has made analysis faster, how much work remains before a human can trust the result enough to make a product decision?**

The product treats that remaining source checking, review, contradiction handling, and decision reconstruction as a **verification tax**. The demo should show how the system makes that tax visible and structured rather than simply producing more AI output.

It uses synthetic data unless explicitly replaced with consented/anonymized customer material. Synthetic examples must never be presented as customer validation.

## 90-second flow

### 1. Import evidence

Import three short sources representing an interview, support/VOC note, and review.

**Proves:** heterogeneous qualitative inputs can enter one persisted workspace and are split into addressable source fragments.

### 2. Run analysis

Run the deterministic development adapter or a configured external provider.

**Proves:** AI is an adapter that proposes structured evidence; the product does not depend on pretending deterministic fixture output is real model intelligence.

### 3. Human verification

Open the Evidence List, trace a proposal to its source fragment, accept/edit one item, and leave another unresolved.

**Proves:** AI output is not silently promoted to truth. Human review state is explicit.

### 4. Contradiction + opportunity

Create an opportunity from reviewed evidence and attach or surface contradictory evidence.

**Proves:** the workspace can preserve evidence that weakens the favored interpretation rather than flattening everything into one summary.

### 5. Challenge

Run the opportunity challenge and open the source-linked response.

**Proves:** a recommendation can be interrogated before action, and the challenge is itself persisted with provenance metadata.

### 6. Human Decision Record

Record one of:

- `experiment`
- `proceed`
- `hold`
- `reject`

Add rationale and next step.

**Proves:** the application distinguishes an AI/research opportunity from the human decision that follows it.

The record snapshots:

- linked evidence
- reviewed evidence
- unresolved evidence
- source fragments
- contradictions
- challenge runs

### 7. Revise, do not overwrite

Record a second decision after new information or a changed judgment.

**Proves:** v2 supersedes v1 while preserving the earlier decision context. The system records how judgment changed instead of rewriting history.

## What the demo must not claim

- It does not prove product-market fit.
- It does not prove a measured reduction in research time.
- Synthetic sources are not real interviews or VOC.
- Deterministic adapter output is not a model-quality benchmark.
- Existing competitors already provide strong AI analysis, citations, and opportunities; the demo should focus on explicit verification state, contradictory evidence, and decision-time snapshots.

## Evidence already available in this repository

- `docs/portfolio/01-killer-opportunity.png` — persisted opportunity
- `docs/portfolio/02-killer-source.png` — exact source trace
- `docs/portfolio/03-architecture.png` — trust/data architecture

The next screenshot worth producing is the Decision Record panel after a versioned decision exists. It is useful application evidence, but it is not a prerequisite for committing the implemented feature.
