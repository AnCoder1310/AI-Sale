# Khung đánh giá năng lực tư vấn bán hàng

*Chủ quản: Đạt (Data/Eval Lead) và Duy (Role-play Lead)*

> Tài liệu này mô tả rubric `sales-rubric-v3` đã triển khai trên nhánh
> `feature/roleplay-reliability`. Tại thời điểm cập nhật tài liệu, evaluator
> trên `develop` vẫn là `sales-rubric-v2` (thang 1–5); cần tích hợp code v3 để
> runtime trên `develop` dùng đúng đặc tả này.

## 1. Nguyên tắc

Rubric đánh giá hành vi có thể quan sát trong transcript, không đánh giá tính cách
và không yêu cầu advisor lặp lại một “ideal script”. Mỗi điểm phải có turn ID,
exact quote và lý do giải thích quote đó đáp ứng anchor nào.

Năm chiều dùng cùng thang 1–3 nhưng có anchor riêng. `1` là bỏ lỡ, sai hoặc
rủi ro; `2` là thực hiện đúng ở mức chuyên nghiệp; `3` là thực hiện đúng và
điều chỉnh rõ ràng theo bối cảnh của khách. Không cộng điểm vì nói dài, trôi
chảy, lịch sự, hỏi nhiều câu, kể nhiều tính năng hoặc gây áp lực chốt mạnh hơn.

1. Need Discovery.
2. Product Knowledge.
3. Objection Handling.
4. Policy Accuracy.
5. Closing / Next Step.

Mỗi criterion có một trong hai trạng thái:

- `ASSESSED`: có cơ hội hợp lý và đủ evidence; bắt buộc có score 1–3.
- `UNASSESSED`: không có cơ hội hợp lý **hoặc** evidence không đủ để kết luận;
  score phải là `null`, `reason` phải nói rõ nguyên nhân nào.

Không dùng `UNASSESSED` để che một missed opportunity. Nếu cơ hội đã xuất hiện
mà advisor không thực hiện hành vi cần thiết, criterion vẫn là `ASSESSED` và
nhận điểm phù hợp. Thiếu nguồn được duyệt không tự động biến thành điểm factual
thấp hoặc một verdict bịa đặt.

## 2. Observable checks

LLM chỉ phân loại các hành vi hẹp; code kiểm tra schema, evidence và tính aggregate.
Mỗi check có verdict:

```text
MET | MISSED | NOT_APPLICABLE | UNCLEAR
```

Keyword matching chỉ dùng khi một exact phrase thật sự bắt buộc. Với discovery và
sales behavior thông thường, evaluator phải hiểu paraphrase tiếng Việt.

### Need Discovery checks

- Tìm hiểu mục đích sử dụng liên quan đến scenario.
- Nhận diện ít nhất một constraint hoặc priority có ý nghĩa.
- Hỏi follow-up dựa trên thông tin khách vừa cung cấp.
- Dùng thông tin đã khám phá trong phần tư vấn sau đó.

### Product Knowledge checks

- Chỉ đưa ra claim sản phẩm có thể kiểm tra bằng nguồn được phê duyệt.
- Phân biệt đúng model/variant/context khi thông tin phụ thuộc phiên bản.
- Giải thích tính năng trong quan hệ với nhu cầu đã khám phá.
- Nêu giới hạn hoặc hỏi làm rõ khi evidence chưa đủ.

### Objection Handling checks

- Ghi nhận đúng băn khoăn thay vì phủ nhận hoặc né tránh.
- Làm rõ nguyên nhân thật của objection khi cần.
- Phản hồi trực tiếp bằng reasoning/evidence phù hợp.
- Kiểm tra lại xem băn khoăn đã được xử lý hay cần bước tiếp theo.

### Policy Accuracy checks

- Claim policy/giá/ưu đãi khớp nguồn được phê duyệt.
- Nêu điều kiện quan trọng ảnh hưởng đến eligibility hoặc quyền lợi.
- Không trình bày policy hết hiệu lực hoặc không xác minh như fact hiện hành.
- Thừa nhận cần kiểm tra thêm khi knowledge base chưa đủ evidence.

### Closing / Next Step checks

- Tóm tắt hoặc liên kết next step với nhu cầu/băn khoăn của khách.
- Đề xuất hành động phù hợp với mức sẵn sàng, không ép chốt.
- Làm rõ owner hoặc cách tiếp tục khi phù hợp.
- Làm rõ thời gian/kênh theo dõi khi cuộc hội thoại tạo cơ hội hợp lý.

Các check là evidence units, không phải công thức đếm máy móc dùng giống nhau cho
mọi dimension. Score phải thỏa anchor bên dưới; code có thể dùng check verdict để
kiểm tra tính nhất quán và phát hiện score không hợp lý.

## 3. Anchor 1–3 theo từng chiều

### 3.1. Need Discovery

| Điểm | Anchor quan sát được |
|---:|---|
| 1 | Bỏ lỡ cơ hội tìm hiểu nhu cầu hoặc tự giả định nhu cầu. |
| 2 | Tìm được nhu cầu liên quan đến quyết định và dùng thông tin đó trong tư vấn. |
| 3 | Làm rõ ưu tiên hoặc sự đánh đổi của khách, rồi điều chỉnh tư vấn theo đó. |

### 3.2. Product Knowledge

| Điểm | Anchor quan sát được |
|---:|---|
| 1 | Thông tin sản phẩm sai ở điểm quan trọng hoặc bỏ qua câu hỏi trực tiếp về sản phẩm. |
| 2 | Trả lời liên quan, được nguồn hỗ trợ. |
| 3 | Chọn lọc fact, lợi ích và giới hạn phù hợp riêng với khách này. |

Không bắt buộc phải nêu nhiều con số. Một câu trả lời ngắn, đúng và phù hợp có thể
được điểm cao hơn một feature dump dài.

### 3.3. Objection Handling

| Điểm | Anchor quan sát được |
|---:|---|
| 1 | Bỏ qua, hiểu sai băn khoăn hoặc gây áp lực cho khách. |
| 2 | Nhận ra băn khoăn và phản hồi phù hợp. |
| 3 | Tìm nguyên nhân sâu hơn, phản hồi đúng trọng tâm và kiểm tra lại với khách. |

Objection không cần “biến mất” để advisor được điểm tốt. Giữ nguyên băn khoăn và
hẹn xác minh có thể là hành vi đúng khi evidence chưa đủ.

### 3.4. Policy Accuracy

| Điểm | Anchor quan sát được |
|---:|---|
| 1 | Sai điều khoản mang tính quyết định, tự hứa quyền lợi hoặc nói chắc khi không có căn cứ. |
| 2 | Claim quan trọng khớp nguồn hiện hành được duyệt; nói rõ điều chưa chắc. |
| 3 | Áp dụng điều kiện hưởng quyền lợi, giới hạn và điều khoản vào trường hợp cụ thể của khách. |

Rubric không hard-code giá, ưu đãi, bảo hành, lãi suất hoặc mốc dung lượng pin.
Những fact thay đổi theo thời gian phải đến từ tài liệu được phê duyệt; factual
finding phải lưu source ID và version đã dùng để kiểm tra claim.

### 3.5. Closing / Next Step

| Điểm | Anchor quan sát được |
|---:|---|
| 1 | Bỏ lỡ cơ hội rõ ràng, đề xuất mơ hồ hoặc ép khách. |
| 2 | Đề xuất bước tiếp theo cụ thể, phù hợp và hỏi khách có đồng ý không. |
| 3 | Điều chỉnh mức cam kết theo sự sẵn sàng và rào cản của khách, xin đồng ý cho một bước cụ thể. |

Không mặc định “đồng ý mua” hoặc “đồng ý lái thử” là success. Kết thúc bằng một
bước xác minh, follow-up hoặc thừa nhận sản phẩm chưa phù hợp vẫn có thể đúng.

Mỗi điểm `ASSESSED` phải dẫn exact quote và message ID từ transcript. Điểm
`2–3` phải có evidence về hành vi advisor; điểm `3` phải dẫn cả bối cảnh khách
và phản hồi advisor, nêu rõ hành vi nào được thay đổi bởi fact nào của khách.
Với điểm `1–2`, `improvement_suggestion` nêu hành vi còn thiếu để đạt mức kế.

## 4. Factual findings

Factual claim được đánh giá tách khỏi sales behavior:

- `SUPPORTED`: nguồn được phê duyệt hỗ trợ claim trong đúng context.
- `CONTRADICTED`: nguồn được phê duyệt mâu thuẫn với claim.
- `UNVERIFIABLE`: knowledge base chưa đủ evidence để kết luận.

Mỗi claim được ghi trong `final_state.factual_claims` phải có đúng một finding.
Finding lưu nguyên văn claim, message ID, source ID/version/exact quote khi có,
và mức độ nghiêm trọng. `UNVERIFIABLE` không tự động có nghĩa advisor sai; một
lời cam kết chắc chắn không có căn cứ có thể ảnh hưởng Policy Accuracy nếu có
evidence từ transcript. Finding `SUPPORTED` hoặc `CONTRADICTED` bắt buộc có
reference đến nguồn được duyệt. Code kiểm tra message ID, exact claim, source ID,
version và exact quote; mỗi source ID chỉ xuất hiện một lần trong một finding.

Runtime lưu evidence có nguồn trong `source_references`, mỗi phần tử gồm
`source_id`, `version` và exact `quote` từ tài liệu được duyệt. `source_ids` được
giữ làm trường tương thích/tìm kiếm nhanh nhưng phải khớp các reference này.

Critical factual finding luôn hiển thị riêng, không bị che bởi overall score.

## 5. Tính điểm và coverage

- Backend tính overall score trên các criterion `ASSESSED`; LLM không tự cung cấp
  một số tổng độc lập.
- Kết quả phải hiển thị `assessed_criteria_count / 5`.
- `overall_score` là trung bình các điểm 1–3 được đánh giá; bằng `null` khi
  không criterion nào được đánh giá.
- Không hiển thị phần trăm năng lực nếu chưa có định nghĩa đã hiệu chuẩn.
- `passed` để `null` cho tới khi team định nghĩa ngưỡng và quy tắc critical error.
- AI result luôn là provisional. Chỉ attempt được submit và Manager approve mới là
  kết quả chính thức.
- Tóm tắt có tối đa một điểm mạnh, tối đa hai góp ý sửa và tối đa một đề xuất
  bài luyện hoặc tài liệu tiếp theo. Các trường feedback do evaluator tạo phải
  bằng tiếng Việt; exact quote giữ nguyên ngôn ngữ gốc.

## 6. Evaluator output và kết quả lưu

Model chỉ trả `evaluations`, `factual_findings`, `summary_strengths`,
`summary_weaknesses` và `recommended_next_practice`. Model không trả
`overall_score`, `assessed_criteria_count`, `passed`, `review_status` hoặc
`rubric_version`; ứng dụng tính/gắn các trường đó. Kết quả lưu có dạng:

```json
{
  "session_id": "SES_TEST_001",
  "scenario_id": "SCENARIO_01",
  "rubric_version": "sales-rubric-v3",
  "assessed_criteria_count": 1,
  "overall_score": 3.0,
  "passed": null,
  "evaluations": [
    {
      "criterion": "need_discovery",
      "status": "assessed",
      "score": 3,
      "checks": [
        {
          "check_id": "identified_intended_use",
          "verdict": "met",
          "evidence": [{"message_id": "turn-4", "quote": "Anh chạy 180 km mỗi ngày, vậy thời gian dừng sạc ảnh hưởng ca làm thế nào ạ?"}],
          "reason": "Tư vấn viên hỏi tiếp theo quãng đường khách đã nêu."
        }
      ],
      "evidence": [
        {"message_id": "turn-3", "quote": "Anh chạy dịch vụ mỗi ngày khoảng 180 km."},
        {"message_id": "turn-4", "quote": "Anh chạy 180 km mỗi ngày, vậy thời gian dừng sạc ảnh hưởng ca làm thế nào ạ?"}
      ],
      "reason": "Tư vấn viên dùng quãng đường khách vừa nêu để hỏi sâu về thời gian dừng sạc.",
      "improvement_suggestion": null
    },
    {
      "criterion": "product_knowledge",
      "status": "unassessed",
      "score": null,
      "checks": [],
      "evidence": [],
      "reason": "Transcript chưa có câu hỏi hoặc trình bày sản phẩm đủ để kết luận.",
      "improvement_suggestion": null
    },
    {
      "criterion": "objection_handling",
      "status": "unassessed",
      "score": null,
      "checks": [],
      "evidence": [],
      "reason": "Khách chưa nêu băn khoăn cần xử lý.",
      "improvement_suggestion": null
    },
    {
      "criterion": "policy_accuracy",
      "status": "unassessed",
      "score": null,
      "checks": [],
      "evidence": [],
      "reason": "Transcript chưa có claim policy để kết luận.",
      "improvement_suggestion": null
    },
    {
      "criterion": "closing_next_step",
      "status": "unassessed",
      "score": null,
      "checks": [],
      "evidence": [],
      "reason": "Cuộc trò chuyện kết thúc trước khi có cơ hội hợp lý để đề xuất bước tiếp theo.",
      "improvement_suggestion": null
    }
  ],
  "factual_findings": [],
  "summary_strengths": ["Tư vấn viên hỏi tiếp dựa trên quãng đường khách vừa chia sẻ."],
  "summary_weaknesses": [],
  "recommended_next_practice": null,
  "review_status": "ai_draft"
}
```

## 7. Validation và hiệu chuẩn

1. Chạy trên calibration set riêng gồm weak, adequate, strong, factual-error và
   partial/not-observed cases.
2. Giữ held-out transcripts tách khỏi prompt/rubric tuning.
3. Reviewer chấm độc lập mà không thấy AI score; lưu label gốc và adjudication.
4. Báo cáo MAE, exact agreement, within-one agreement, applicability agreement,
   evidence correctness, critical factual miss rate và repeat stability.
5. Không tính năm criterion trong một transcript thành năm ca độc lập.
