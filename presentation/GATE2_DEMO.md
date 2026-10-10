# Gate 2 — kịch bản video 3 phút

Quay **một user flow thật chạy local trên `develop`**. Trước khi quay, chuẩn bị `.env`, seed tài khoản demo, chạy backend/frontend; tuyệt đối không quay terminal chứa key/mật khẩu. Có thể cắt thời gian chờ model, nhưng không thay kết quả thật bằng màn hình giả. Ghi commit SHA và ngày quay trong mô tả video.

| Mốc | Cảnh cần hiện | Lời dẫn ngắn |
| --- | --- | --- |
| 0:00–0:20 | Trang đăng nhập, vào Advisor | “Tư vấn viên mới cần thông tin có nguồn và luyện tập bán hàng nhất quán.” |
| 0:20–0:55 | Copilot: hỏi giá niêm yết VF 8, mở citation gốc | “Câu trả lời đi kèm tài liệu, không tự biến MSRP thành giá lăn bánh.” |
| 0:55–1:45 | Chọn VF 5 Plus khách chạy dịch vụ, hỏi quãng đường và tiền xăng thực tế, xử lý lo ngại sạc/chi phí | “AI Customer chỉ tiết lộ nhu cầu khi được hỏi; không cần diễn đủ mọi lượt trong video.” |
| 1:45–2:10 | Bấm kết thúc, hiện điểm AI draft và một finding có quote/evidence | “Điểm và nhận xét liên kết với lời tư vấn đã nói.” |
| 2:10–2:40 | Đăng nhập Manager, mở đúng attempt, xem transcript, duyệt (có lý do nếu sửa điểm) | “Quản lý kiểm tra trước khi điểm trở thành kết quả được duyệt.” |
| 2:40–3:00 | Quay lại Advisor xem attempt đã duyệt/lịch sử và kết | “Nhân viên thấy tiến bộ và có thể luyện lại.” |

Nếu live judge/provider trễ, chuẩn bị trước **một attempt thật đã hoàn thành** trong cùng local database để có thể quay phần manager review; đừng giới thiệu attempt cũ đó như kết quả của cuộc chat vừa quay. Nếu kết thúc/chấm fail, quay lại sau khi sửa, không ghép một kết quả không liên quan. Video 3 phút không thay cho 5 test cases manual; bảng evidence riêng nằm ở `eval/results/gate2_manual_cases_2026-10-04.md`.
