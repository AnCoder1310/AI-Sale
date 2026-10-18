# Judge calibration v4: DeepSeek V3.2 comparison (2026-10-18)

Three live DeepSeek V3.2 runs (`judge_calibration_v4_deepseek_run{1,2,3}.json`)
compared against `eval/datasets/judge_calibration_v4.json` (rubric
`sales-rubric-v4`, 6 cases, 30 approved labels). Raw output:
`judge_calibration_v4_compare_2026-10-18.json`.

## Summary

- Cases evaluated: 5 of 6 (JC1-JC5). Overall status is INCOMPLETE because JC6 failed.
- Pooled exact agreement: 97.6% (mean over runs), MAE 0.024 on 14 scored pairs.
- Applicability agreement: 76% (19/25 label pairs).
- Stability: 22/25 labels identical across runs (88%), 2 status flips, mean score range 0.056.

## Known limitation: JC6 failed in all 3 runs

`JC6_VF6_PLUS_UPSELL` produced no prediction in any run:

- Runs 1-2 (2x): `structured model invocation failed for FactualFindingsDraft`
- Run 3 (1x): `factual source quote is not exact: PROMOTION_SALES_VINFAST_20260921`

JC6 is therefore excluded from every metric below. Treat results as covering JC1-JC5 only.

## Per-criterion (mean over 3 runs)

| Criterion | Scored pairs | Exact agreement | Within one | Applicability agreement |
|---|---|---|---|---|
| need_discovery | 4 | 100% | 100% | 80% (4/5) |
| product_knowledge | 1 | 100% | 100% | 40% (2/5) |
| objection_handling | 4 | 91.7% | 100% | 80% (4/5) |
| policy_accuracy | 1 | 100% | 100% | 80% (4/5) |
| closing_next_step | 4 | 100% | 100% | 100% (5/5) |

## Applicability disagreements

"Unassessed" is a valid expert label by design: no fair opportunity in the
transcript means no score. Disagreements:

- Judge scored where the expert label is unassessed: JC2 product_knowledge=1,
  JC2 objection_handling=2, JC4 product_knowledge=1, JC5 need_discovery=2.
- JC1 policy_accuracy: expert label 1, but the judge was unassessed in all runs
  (no policy was discussed).

These 5 cells are pending re-check by sales expert Tú.

## Tóm tắt (Tiếng Việt)

Ba lần chạy DeepSeek V3.2 trên 5/6 case (JC1-JC5): đồng thuận chính xác 97,6%,
MAE 0,024 trên 14 cặp có điểm; đồng thuận về applicability 76% (19/25); ổn định
22/25 nhãn giống nhau giữa các lần, 2 lần đổi trạng thái. JC6 lỗi ở cả 3 lần
(giới hạn đã biết). 5 ô lệch applicability đang chờ chuyên gia Tú kiểm tra lại.
