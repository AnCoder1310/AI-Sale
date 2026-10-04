# VF 5 Plus role-play realism probe — 2026-10-04

Three OpenRouter runs used synthetic Vietnamese advisor messages with the production customer and turn-analysis models. The complete transcripts and counters are in `roleplay_realism_smoke_2026-10-04.json`. This is a small behavior probe, not a statistical quality estimate or browser E2E test.

| Run | Observation |
| --- | --- |
| Helpful advisor | Mileage was disclosed after the advisor asked. The customer accepted a proposed cost comparison, but the old transition still forced dropout on the next turn. |
| Missed concern | The customer asked about total running cost twice and deferred after the advisor repeatedly ignored it. This progression was appropriate. |
| Discovery and next step | Mileage was disclosed correctly. The customer raised charging downtime, but the old counter missed its first mention and allowed an extra repeat after an appointment proposal. |

No transcript contained a false claim that mileage had been spoken before the customer disclosed it. The three transcripts did contain two progression defects described above. They also showed that the advisor had room to ask about mileage and schedule, address an objection, and propose a next step, although an acceptance or completion was not reliably honored by the old transition.

After reviewing the runs, the implementation was changed to record the first customer message for each concern, count only subsequent prompts, and let a customer acceptance of a concrete next step resolve the focused concern. Deterministic tests cover those transitions. These changes were **not rerun against OpenRouter**; the three approved live runs were completed before this correction.
