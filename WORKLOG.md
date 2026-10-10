# Worklog — Nhóm dự án

> Ghi lại tất cả công việc đã làm theo ngày. Ai làm gì, kết quả gì.

## Thành viên

| Họ và tên | Mã sinh viên |
|---|---|
| Phạm Đình Duy | 2A202602913 |
| Phạm Quốc Đạt | 2A202602384 |
| Võ Trường An | 2A202602656 |
| Nguyễn Hữu Chương | 2A202602601 |

---

## [YYYY-MM-DD]

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| [Tên] | [mô tả task] | ✅ Done | [link/kết quả] | 2h |
| [Tên] | [mô tả task] | 🔄 WIP | [mô tả tiến độ] | 1.5h |
| [Tên] | [mô tả task] | ❌ Blocked | [lý do block] | - |

**Tổng kết ngày:** [1-2 câu về tiến độ chung]

---

## [YYYY-MM-DD]

| Member | Task | Status | Output | Time |
|--------|------|--------|--------|------|
| | | | | |

**Tổng kết ngày:**

---

## 2026-10-04

| Member | Task | Status | Output | Time |
|---|---|---|---|---|
| Võ Trường An | Gắn hình ảnh xe VinFast từ assets/vehicles vào dự án | ✅ Done | Tích hợp ảnh xe cho HomeView, KnowledgeView, ScenarioCatalog, PracticeRoom, AssignmentsView, ManagerDashboardView | 2.5h |
| Võ Trường An | Cập nhật logo VinFast 3D chrome và favicon/icon | ✅ Done | Chuẩn hóa biểu tượng VinFast chrome metallic sắc nét trên Icons.jsx, favicon.svg, icon.svg, Header, Sidebar | 1.5h |
| Võ Trường An | Cập nhật Manager Frontend theo phong cách thiết kế chuẩn | ✅ Done | Hoàn thiện layout Dashboard, Team, Assignments, History, Review Queue HITL kết nối API backend thật | 2.0h |
| Võ Trường An | Chuẩn hóa 4 phân mục Tri thức và thiết lập Danh mục tệp PDF cần chuẩn bị | ✅ Done | Để trống dữ liệu tự tạo theo yêu cầu (Thông số xe, Chính sách, Biểu phí, FAQ); hiển thị danh mục 21 tệp PDF chuẩn hóa kèm mã định danh, nội dung yêu cầu và hướng dẫn nạp | 1.5h |
| Võ Trường An | Sửa lỗi phân quyền 403 Forbidden trên endpoint /practice/scenarios | ✅ Done | Mở rộng quyền truy cập danh mục kịch bản luyện tập cho cả role `advisor` và `manager`, bổ sung test tự động | 0.5h |
| Võ Trường An | Tích hợp toàn bộ tệp PDF trong frontend/src/data làm nguồn dữ liệu chính thức | ✅ Done | Kết nối 17 tệp PDF thực tế (Hợp đồng mua bán, thuê pin, bảo hành, giá xe, biểu phí sạc V-GREEN) làm data nguồn cho KnowledgeView kèm trình đọc PDF trực tiếp | 1.5h |
| Võ Trường An | Chuyển đổi toàn bộ giao diện sang hệ màu Đen - Trắng - Xám (Monochrome), loại bỏ toàn bộ màu xanh lá | ✅ Done | Loại bỏ 100% màu xanh lá và các gam màu accent trên CSS toàn hệ thống, KnowledgeView, Review Queue, Manager Console, Copilot, Scorecard; áp dụng chuẩn bảng màu đơn sắc cao cấp | 1.0h |
| Võ Trường An | Hoàn thiện toàn bộ menu Admin/Manager (Dashboard, Team, Assignments, Performance, Reports) theo đúng thiết kế và yêu cầu group theo User | ✅ Done | 1. Xây dựng cấu trúc Menu 5 mục chuẩn (, , , , ). 2. Group Review Queue và Lịch sử attempt theo từng User (giải quyết triệt để lo ngại bị loạn lượt chơi). 3. Bổ sung chế độ xem chi tiết từng người gồm Lịch sử chat transcript và thông số đánh giá 5 kỹ năng. 4. Xây dựng mục Scenarios & Ranking Leaderboard (bảng xếp hạng điểm cao nhất theo từng mẫu xe). 5. Thêm hình ảnh trực quan xe VinFast trong Tổng quan. Tuân thủ 100% chuẩn đen trắng xám monochrome. | 3.0h |

**Tổng kết ngày:** Hoàn thành đồng bộ toàn bộ ảnh xe VinFast, logo 3D chrome, giao diện Manager console. Thiết lập 4 phân mục Tri thức độc lập (Thông số xe, Chính sách, Biểu phí, FAQ), để trống dữ liệu tự tạo chờ nạp tài liệu thực tế và cung cấp bảng tổng hợp 21 tệp PDF chi tiết. Khắc phục lỗi 403 Forbidden cho Manager khi tải scenarios. Frontend build & lint 100% clean, 181 backend tests pass.

<!-- Format: copy block trên cho mỗi ngày làm việc -->
