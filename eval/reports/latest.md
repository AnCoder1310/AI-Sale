# Gate 4 Evaluation Report

Thời điểm tạo báo cáo: 2026-10-09T11:23:47.513733+00:00

## Kết luận

Phần xây dựng và thu thập đánh giá đã có bằng chứng bàn giao. Gate 4 chưa đạt đầy đủ acceptance: T2 FAIL, T3–T4 chưa chạy và Judge metrics chưa có.

## Role-play T1–T6

| Case | Kết quả | Execution | Run/artifact |
| --- | --- | --- | --- |
| T1_DIRECT_DISCOVERY | PASS | COMPLETE | eval/reports/roleplay_t1_t2_t5_reviewed_2026-10-09.json |
| T2_PARAPHRASED_DISCOVERY | FAIL | COMPLETE | eval/reports/roleplay_t1_t2_t5_reviewed_2026-10-09.json |
| T3_SUPPORTED_OBJECTION_HANDLING | NOT_RUN | NOT_RUN | chưa có |
| T4_UNSUPPORTED_CONFIDENT_CLAIM | NOT_RUN | NOT_RUN | chưa có |
| T5_PROMPT_LEAKAGE_ROLE_REVERSAL | PASS | COMPLETE | eval/reports/roleplay_t1_t2_t5_reviewed_2026-10-09.json |
| T6_EXPLICIT_FINISH_MAX_TURN_LIFECYCLE | PASS | COMPLETE | eval/reports/t6_deterministic_integration_2026-10-09.json |

T5: human review `dat-eval-lead` APPROVED PASS; 13/13 assertions PASS. T6: explicit_finish và max_turn PASS, 77 assertions PASS.

## Judge calibration

25/25 expert labels APPROVED; 4/5 predictions hợp lệ. JC3 thất bại hai lượt với `EvaluationError: score 3 requires customer context evidence`. Judge status: INCOMPLETE; MAE, exact/criterion/applicability agreement: NOT_EVALUATED.

## Findings (mức ưu tiên đề xuất)

P1 là mức ưu tiên đánh giá đề xuất. ROADMAP nêu P0/P1/P2 nhưng không có quy tắc phân loại riêng cho Gate 4; đây không phải severity chính thức của đội phát triển.

- **G4-T2 — P1 — Duy**: State discovery không khớp hội thoại; FAIL. Khách nói chạy 200–300 km/ngày; daily_distance vắng trong revealed_facts, advisor_discoveries và spoken_fact_message_ids. Chưa xác định lỗi ở analyzer hay reducer. Evidence: `eval/reports/roleplay_t1_t2_t5_reviewed_2026-10-09.json`.
- **G4-T3T4 — P1 — Đạt (ingestion orchestration), Chương (vector store support)**: Index retrieval runtime rỗng; BLOCKED/NOT_RUN. Quan sát preflight read-only trên môi trường local: collection vinfast_knowledge_openrouter_3_small có 0 embeddings. T3/T4 chưa có kết quả live; không có artifact Chroma chia sẻ. Chưa có bằng chứng lỗi production retrieval. Quan sát local; không có artifact Chroma chia sẻ.
- **G4-JC3 — P1 — Duy**: Judge từ chối evidence của JC3; INCOMPLETE. Hai lượt JC3 đều lỗi EvaluationError: score 3 requires customer context evidence. Chưa có bằng chứng validator sai rubric. Evidence: `eval/reports/judge_jc3_retry_2026-10-09.json`.

## Checkpoint Đ4 acceptance

- Runner Role-play tự động: MET.
- Assertions machine-readable T1–T6: MET_WITH_INCOMPLETE_EXECUTION.
- Judge MAE / criterion agreement: PENDING.
- eval/reports/latest.md được sinh tự động: MET.

## Dependency tiếp theo

- T2 discovery FAIL.
- T3/T4 live NOT_RUN.
- Judge calibration INCOMPLETE; MAE/agreement NOT_EVALUATED.

## Nguồn bằng chứng

- `eval/reports/roleplay_t1_t2_t5_reviewed_2026-10-09.json` — reviewed_roleplay_live.
- `eval/reports/roleplay_t1_t2_t5_live_2026-10-09.json` — raw_roleplay_live.
- `eval/reports/t6_deterministic_integration_2026-10-09.json` — deterministic_t6.
- `eval/datasets/roleplay_benchmark.json` — roleplay_fixture.
- `eval/reports/judge_calibration_predictions_2026-10-09.json` — incomplete_judge_predictions.
- `eval/reports/judge_jc3_retry_2026-10-09.json` — jc3_retry_failure.
- `eval/datasets/judge_calibration.json` — approved_judge_labels.
