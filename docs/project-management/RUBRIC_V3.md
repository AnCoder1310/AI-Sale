# Sales coaching rubric v3 (MVP)

This is the normative rubric for **new** role-play evaluations. Five skills remain; each assessed skill has a behaviorally anchored score of **1, 2, or 3**. `UNASSESSED` is not zero: the `reason` must say whether the conversation offered no fair opportunity or whether the available transcript/approved sources could not support a conclusion. A fair opportunity that the advisor misses is scored 1.

| Skill | 1 — Below standard | 2 — Proficient | 3 — Context-adaptive |
| --- | --- | --- | --- |
| Need Discovery | Assumes needs or misses a reasonable discovery opportunity. | Finds a decision-relevant need/constraint and uses it in advice. | Clarifies priority or trade-off and adapts advice to that customer insight. |
| Product Knowledge | Makes a materially wrong claim or ignores a direct, relevant product question. | Answers accurately with approved product evidence relevant to the question. | Selects relevant benefits **and limitations** for this customer's needs, without a feature dump. |
| Objection Handling | Ignores/misreads a concern, argues, or pressures. | Recognizes the concern and responds appropriately; clarifies when needed. | Finds the underlying cause, responds in context, then checks whether the concern remains. |
| Policy Accuracy | Misstates a decisive term, invents a commitment, or presents an unverified policy as certain. | Important claims match applicable approved sources; uncertainty is stated. | Applies eligibility, conditions and limits correctly to this customer's case. |
| Closing / Next Step | Misses a fair progression opportunity, gives a vague step, or pushes beyond readiness. | Proposes a concrete suitable next step and asks for agreement. | Matches the commitment to readiness and remaining barrier, and seeks a specific mutual agreement. |

## Judge instructions and evidence

Score each criterion independently, using observable transcript behavior. A score of 3 requires a cited customer fact and a cited advisor response demonstrating adaptation; pleasant tone, longer answers, more questions and stronger pressure are not substitutes. For scores 1 and 2, `improvement_suggestion` states what observable behavior would earn the next level. Every assessed score cites exact `message_id` + quote. A missed opportunity may cite the customer turn that created it and the subsequent advisor turn that missed it. `reason` for `UNASSESSED` explicitly says **no fair opportunity** or **insufficient evidence**; a missing knowledge source never proves a factual claim false.

Factual findings remain separate: `SUPPORTED`, `CONTRADICTED`, `UNVERIFIABLE`, with source references for the first two. A serious contradicted claim should be prominent even if the arithmetic mean is high. Source ID/version/quote integrity is checked by code; whether a source semantically supports a claim still needs evaluation and manager review. The application calculates the mean of assessed skills and displays assessed coverage (for example, 3/5 skills). Do not call a one-session result an employee's career level.

## Synthetic boundary examples for calibration design

These examples illustrate boundaries, **not** expert-labelled benchmark results or wording templates. An expert should independently label full transcripts before judge reliability is claimed.

1. **Discovery 1→2:** Anh Nam says he drives for hire and worries about running costs. Advisor immediately asserts a monthly saving without asking distance: 1. Advisor asks monthly mileage and uses the answer in a tailored comparison plan: at least 2. A higher score additionally needs evidence of his priority or trade-off and a consequent change in advice.
2. **Product Knowledge 2→3:** Advisor gives a source-supported charging specification relevant to the VF 5 question: 2. Advisor also explains how the specification's conditions and limits affect Nam's midday driving pattern: potentially 3, if both customer context and response are in the transcript.
3. **Objection 1→2→3:** Customer fears charging downtime. Ignoring it: 1. Acknowledging it and offering a reasonable verification step: 2. Asking about work breaks, adapting the option to his schedule, and checking whether that addresses the concern: 3. Do not require a redundant clarification question if the cause is already clear.
4. **Policy 1→2→3:** An invented guaranteed promotion: 1 if contradicted by an applicable source. Correct current terms with a stated unknown: 2. Correctly explaining customer-specific eligibility, conditions and limitations: 3. If sources are missing, use `UNASSESSED` with an insufficient-evidence reason, not an invented verdict.
5. **Next step 1→2→3:** Customer wants to verify costs before deciding. “Contact me sometime”: 1. Offer to send a cost breakdown and ask if he wants it: 2. Tie that breakdown to his 5,000 km/month and agree what figures to check and when to follow up: 3. No deposit pressure is needed.

## Validation before claiming judge quality

Use a few full transcripts for prompt/rubric tuning, then a separate held-out set of at least 20 transcripts labelled by qualified reviewers if claiming the advanced expert-agreement requirement. Report per-skill exact agreement and mean absolute error, `ASSESSED`/`UNASSESSED` agreement, wrong/missing evidence references, severe factual misses and repeat stability. Do not count synthetic examples above or tuning transcripts in the held-out set. The 1–3 score contract replaces only local test attempts; production/shared historical data must not be silently deleted or reinterpreted.
