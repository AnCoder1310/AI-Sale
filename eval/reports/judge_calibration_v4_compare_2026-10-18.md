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

### When a criterion is "unassessed"

"Unassessed" (score null) is a valid label for both the expert and the
production judge (`src/models/evaluation.py`, `src/agents/roleplay/prompts/evaluator.py`).
It is used only when:

1. **No fair opportunity**: the conversation never gave the advisor a chance to
   show that skill. Examples: the customer raised no objection
   (objection_handling), nobody discussed price or policy (policy_accuracy), or
   the transcript ends before a closing moment (closing_next_step).
2. **Insufficient evidence**: the transcript is too short to judge.

If there was an opportunity and the advisor missed it, the criterion is
assessed with score 1, not unassessed. A missed opportunity is a weakness;
no opportunity is not. Unassessed criteria are excluded from `overall_score`,
and the UI shows "Chưa chấm". One exception is enforced in code:
policy_accuracy must be scored when the scenario has policy expectations and
the advisor discussed price or policy. Never force a low score without
transcript evidence.

### Disagreements

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

**Nhãn "chưa chấm"** chỉ dùng khi hội thoại không cho nhân viên cơ hội thể hiện
kỹ năng đó (ví dụ khách không phản đối, chưa ai nói về giá/chính sách, hội thoại
dừng trước lúc chốt), hoặc transcript quá ngắn để kết luận. Nếu có cơ hội mà
nhân viên bỏ lỡ thì chấm 1 điểm, không để "chưa chấm". Tiêu chí "chưa chấm"
không tính vào điểm tổng; app hiển thị "Chưa chấm". Riêng policy_accuracy bắt
buộc phải chấm khi kịch bản có chính sách cần nêu và nhân viên đã nói về giá
hoặc chính sách.
