# Judge calibration

`judge_calibration.json` contains five original expert-approved cases and one
scenario-04 VF 6 Plus upsell conversation awaiting expert review. The original
case bytes and dataset version are preserved; this append does not relabel or
supersede the v1 expert annotations.

Each unreviewed criterion uses `review_status: PENDING_EXPERT_REVIEW`,
`adjudication_status: PENDING`, null status/score/review provenance, and empty
evidence. Validation reports pending expert review; comparison excludes these
labels from every agreement denominator even if an AI prediction is present.
AI predictions never promote pending labels to approved labels.

Offline validation and comparison retain the stored rubric and scenario
versions. The original cases use historical scenario versions and rubric v3,
while the current evaluator uses v4; reports expose this drift. The adapter
requires matching scenario versions to prepare evaluator state and matching
rubric versions before calling a live model. New expert review or a deliberate
versioned calibration migration is required before evaluating with rubric v4.
Knowledge evidence is loaded from both `data/knowledge/corpus.json` and
`data/knowledge/faq.json`, with source version and exact quote checks.

```bash
APP_ENV=test .venv/bin/python -m eval.judge_eval.run
APP_ENV=test .venv/bin/python -m eval.judge_eval.adapter --preflight --case-id JC6_VF6_PLUS_UPSELL_PENDING
```

The second command validates the new case without constructing an LLM and
reports `OFFLINE_VALIDATED_RUBRIC_MISMATCH`; this is not approval to run a live
evaluation. `run --mode live` remains a dry path with exit code 3 and no model
calls.
