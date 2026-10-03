# Evaluation Report

> Báo cáo bằng chứng kiểm thử hiện có của sản phẩm. Cập nhật gần nhất:
> 29/09/2026.

---

## 1. Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Response accuracy | >80% | Chưa đo | Chưa xác minh |
| Response latency | <3s | Chưa đo | Chưa xác minh |
| User satisfaction | >4/5 | Chưa thu thập | Chưa xác minh |
| Test coverage | >60% | Chưa chạy coverage | Chưa xác minh |

## 2. Test Results

### Role-play và Practice API

Đã chạy:

```bash
.venv/bin/pytest tests/test_roleplay tests/test_api/test_practice_chat.py -q
```

Kết quả:

```text
72 passed in 2.21s
```

Phạm vi đã kiểm tra gồm scenario contract, hidden-fact isolation, turn analysis,
state transitions, customer response validation, session graph, evaluator,
Practice service và Practice API.

### Full Test Suite

Đã thu thập được 77 test:

```bash
.venv/bin/pytest --collect-only -q
```

Lần chạy toàn bộ suite chưa hoàn tất. Quá trình dừng tiến triển sau test đầu tiên
trong nhóm generic template agent và được chủ động dừng sau hơn 90 giây. Vì vậy
không được báo cáo full suite là pass cho đến khi nguyên nhân được xác định.

### Static Checks

Đã chạy:

```bash
.venv/bin/ruff check src backend tests
```

Kết quả: PASS.

Kiểm tra format:

```bash
.venv/bin/ruff format --check src backend tests
```

Kết quả: FAIL; sáu file cần được format:

```
src/models/evaluation.py
src/agents/roleplay/contracts.py
src/agents/roleplay/graph.py
src/agents/roleplay/state.py
src/services/practice.py
tests/test_roleplay/test_practice_service.py
```

### Integration Tests

Luồng end-to-end Frontend → FastAPI → model/provider → persistence → Frontend
chưa được chạy trên branch hiện tại. Deployment và smoke test production cũng
chưa được xác minh.

## 3. User Feedback

| User | Feedback | Rating |
|------|----------|--------|
| — | Chưa thu thập feedback có cấu trúc | — |

## 4. Demo Results

- Ngày demo: Chưa ghi nhận
- Người tham gia: Chưa ghi nhận
- Feedback chung: Chưa có bằng chứng
- Issues phát hiện: Chưa chạy demo end-to-end trên bản deploy

## 5. Action Items

- [ ] Điều tra test generic template agent bị dừng tiến triển trong full suite.
- [ ] Format sáu file được Ruff báo cáo rồi chạy lại format check.
- [ ] Chạy full suite và coverage sau khi xử lý test bị dừng tiến triển.
- [ ] Chạy integration/E2E trên ứng dụng đã compose và ghi lại bằng chứng.
- [ ] Bổ sung benchmark Copilot, role-play trajectories và Judge calibration.
