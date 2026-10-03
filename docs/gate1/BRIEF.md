# Brief: VFO2O-20 — AI Sales Enablement Coach for Automotive Advisors

## 1. Bài toán

Tư vấn viên bán xe mới phải học và cập nhật đồng thời:

- nhiều mẫu xe và thông số sản phẩm;
- giá, ưu đãi và chính sách thay đổi thường xuyên;
- kiến thức về bảo hành, pin, sạc và các chương trình liên quan;
- kỹ năng tư vấn và giao tiếp với nhiều kiểu khách hàng khác nhau.

Đào tạo truyền thống tốn thời gian, phụ thuộc nhiều vào quản lý đào tạo và khó tạo đủ tình huống thực hành trước khi nhân viên gặp khách thật.

Một rủi ro đặc biệt của ngành ô tô là **tư vấn sai thông tin hoặc sử dụng chính sách đã hết hiệu lực**, ảnh hưởng trực tiếp tới trải nghiệm và niềm tin của khách hàng.

Ngoài ra, một tư vấn viên có thể nhớ kiến thức nhưng vẫn chưa biết cách áp dụng hiệu quả trong tình huống thực tế.

---

## 2. Người dùng

### Tư vấn viên bán hàng

Cần:

1. tra cứu nhanh thông tin chính xác trong quá trình làm việc;
2. luyện tập các tình huống tư vấn trước khi gặp khách thật;
3. nhận phản hồi sau mỗi phiên luyện tập;
4. xem lại lịch sử và kết quả các phiên đã thực hiện.

### Quản lý đào tạo

Cần:

1. xem kết quả luyện tập của nhân viên;
2. kiểm tra và điều chỉnh đánh giá do AI tạo;
3. theo dõi các phiên luyện tập;
4. đảm bảo hệ thống sử dụng nguồn kiến thức chính xác và còn hiệu lực.

---

## 3. Giải pháp

Xây dựng **AI Sales Enablement Platform** gồm hai chức năng chính.

### Feature 1 — Trợ lý kiến thức

Tư vấn viên có thể hỏi về:

- sản phẩm;
- thông số xe;
- giá;
- ưu đãi;
- bảo hành;
- pin và sạc;
- chính sách bán hàng.

Hệ thống sử dụng RAG trên kho kiến thức được chuẩn bị từ các nguồn chính thức và trả lời kèm nguồn tham chiếu.

Mỗi tài liệu có thể lưu thêm metadata như:

```text
Tên tài liệu
Loại tài liệu
Nguồn
Ngày / phiên bản
Ngày hiệu lực
Mẫu xe liên quan
URL gốc
```

Nếu không tìm được nguồn đủ tin cậy, AI phải thông báo rằng chưa thể xác minh thay vì tự suy đoán.

Trong MVP, knowledge corpus được team chuẩn bị trước từ các nguồn chính thức.

---

### Feature 2 — AI Practice Coach

Tư vấn viên chọn một tình huống luyện tập.

Ví dụ:

```text
Tình huống A
Tình huống B
Tình huống C
Tình huống D
```

AI đóng vai khách hàng và hội thoại nhiều lượt với tư vấn viên.

AI Customer phải:

- giữ đúng vai khách hàng;
- nhớ lịch sử hội thoại;
- phản ứng dựa trên câu trả lời trước của tư vấn viên;
- tiết lộ thông tin dần dần;
- duy trì tính nhất quán của tình huống.

Mỗi scenario chỉ hiển thị cho tư vấn viên những thông tin họ có thể biết hợp lý
trước cuộc tư vấn, như kênh trao đổi, giai đoạn bán hàng và nhu cầu đã được khách
chủ động nêu. Ngân sách, thói quen sử dụng, điều kiện sạc và các băn khoăn chưa
được nêu vẫn là thông tin cần khám phá. AI Customer hiểu ý nghĩa của câu hỏi và
không yêu cầu tư vấn viên phải dùng đúng một câu hoặc một từ khóa cố định.

Độ khó được chọn trước khi bắt đầu và giữ cố định trong một attempt để kết quả
giữa các lần luyện tập có thể so sánh. Điều chỉnh độ khó ngay trong hội thoại là
tính năng sau MVP.

Sau khi kết thúc phiên, hệ thống phân tích hội thoại và tạo đánh giá theo các tiêu chí được cấu hình.

Ví dụ:

```text
Kỹ năng 1
Kỹ năng 2
Kỹ năng 3
Kỹ năng 4
```

MVP sử dụng năm chiều đánh giá:

```text
Need Discovery
Product Knowledge
Objection Handling
Policy Accuracy
Closing / Next Step
```

Mỗi chiều có mô tả hành vi quan sát được, trạng thái áp dụng, thang điểm 1–5 và
dẫn chứng bằng lượt hội thoại. Nếu phiên không tạo cơ hội hợp lý để thể hiện một
kỹ năng, hệ thống ghi `NOT_OBSERVED` thay vì tự gán điểm thấp.

Kết quả có thể bao gồm:

- điểm tổng quan;
- điểm theo từng kỹ năng;
- phần làm tốt;
- phần cần cải thiện;
- dẫn chứng từ hội thoại;
- gợi ý cải thiện.

Kết quả AI ngay sau phiên là bản nháp để tư vấn viên học và thử lại. Mọi attempt
hoàn thành được lưu tự động; card tình huống hiển thị kết quả gần nhất và cho phép
mở lịch sử các attempt cũ. Hàng đợi Manager group theo tư vấn viên + tình huống và
ưu tiên attempt mới nhất chưa review. Quản lý có thể **phê duyệt hoặc chỉnh sửa**
điểm, nhận xét và đề xuất luyện tập tiếp theo trước khi một kết quả trở thành chính
thức.

---

## 4. Luồng sử dụng chính

```text
                     TƯ VẤN VIÊN
                          │
            ┌─────────────┴─────────────┐
            │                           │
     TRA CỨU KIẾN THỨC            LUYỆN TẬP
            │                           │
        Đặt câu hỏi                Chọn tình huống
            │                           │
       Tìm nguồn hiện tại          AI Customer
            │                           │
      Trả lời + nguồn          Hội thoại nhiều lượt
                                        │
                                  Kết thúc phiên
                                        │
                                  AI phân tích
                                        │
                            Bản nháp + dẫn chứng
                                        │
                              Tự động lưu attempt
                                        │
                         Manager ưu tiên attempt mới nhất
                                        │
                              Phê duyệt / chỉnh sửa
```

---

## 5. Kho kiến thức

Trong MVP, knowledge corpus được team chuẩn bị sẵn từ các nguồn chính thức.

Các nguồn có thể gồm:

- chính sách bán hàng;
- bảng giá;
- chính sách ưu đãi;
- bảo hành;
- thông tin pin/sạc;
- thông tin sản phẩm;
- FAQ chính thức.

Quy trình dữ liệu tổng quát:

```text
Nguồn chính thức
      ↓
Đọc và làm sạch nội dung
      ↓
Lưu metadata / phiên bản
      ↓
Chia nội dung thành các đoạn phù hợp
      ↓
Tạo embedding
      ↓
Knowledge Base
      ↓
RAG
```

Tự động phát hiện và cập nhật chính sách mới có thể được phát triển sau MVP.

---

## 6. Điểm khác biệt

### 6.1. Grounded Knowledge

AI không trả lời chỉ dựa vào kiến thức có sẵn của mô hình.

Thông tin về sản phẩm và chính sách phải được lấy từ nguồn chính thức trong knowledge base.

---

### 6.2. Kiểm soát phiên bản và thời gian hiệu lực

Một chính sách cũ vẫn có thể rất giống về nội dung với chính sách mới.

Vì vậy hệ thống lưu thêm thông tin về:

```text
Version
Ngày xuất bản
Ngày hiệu lực
Trạng thái tài liệu
```

để giảm nguy cơ trả về chính sách đã hết hiệu lực.

---

### 6.3. Luyện tập nhiều lượt

AI Customer không chạy một danh sách câu hỏi cố định.

Phản ứng của khách hàng thay đổi dựa trên những gì tư vấn viên đã nói trong các lượt trước.

---

### 6.4. Feedback có dẫn chứng

AI không chỉ đưa ra điểm số.

Mỗi nhận định và điểm số phải chỉ ra lượt hội thoại liên quan để người dùng hiểu
tại sao mình nhận được feedback đó. Dẫn chứng được kiểm tra để bảo đảm quote và
turn ID thật sự tồn tại trong transcript.

---

### 6.5. Human-in-the-loop

AI hỗ trợ quản lý đào tạo nhưng không tự động quyết định kết quả cuối cùng của nhân viên.

Quản lý có thể:

```text
Phê duyệt
Chỉnh sửa
Thêm ghi chú

Điều chỉnh đề xuất luyện tập tiếp theo
```

---

## 7. MVP

### Tư vấn viên bán hàng

```text
Đăng nhập

Trợ lý kiến thức có nguồn tham chiếu

Xử lý câu hỏi không có đủ nguồn

Chọn một số tình huống luyện tập có sẵn

Hội thoại nhiều lượt với AI Customer

Xem kết quả sau phiên

Luyện tập lại hoặc mở lịch sử attempt của tình huống

Xem các phiên luyện tập gần đây
```

### Quản lý đào tạo

```text
Xem danh sách attempt đã được tư vấn viên gửi và đang chờ

Xem transcript và đánh giá AI

Phê duyệt hoặc chỉnh sửa kết quả

Thêm ghi chú khi cần
```

### AI / Backend

```text
LangGraph orchestration

RAG + nguồn tham chiếu

Metadata và version tài liệu

Bộ nhớ hội thoại nhiều lượt

AI Customer

Phân tích phiên luyện tập

Kiểm tra factual claim theo nguồn được phê duyệt

Lưu transcript trước khi chạy đánh giá và lưu lịch sử phiên

Lưu thay đổi của Manager

Knowledge corpus được chuẩn bị sẵn
```

---

## 8. Tính năng sau MVP

Có thể phát triển thêm:

```text
Lộ trình học cá nhân hóa nhiều bước

Theo dõi tiến bộ theo thời gian

Dashboard toàn đội

Độ khó tự thích ứng ngay trong hội thoại

Tự động phát hiện chính sách mới

Tự động cập nhật knowledge corpus

So sánh thay đổi giữa hai phiên bản chính sách

Tự động sinh tình huống luyện tập

Các chức năng đào tạo nâng cao
```

---

## 9. Ngoài phạm vi

Không xây trong sản phẩm này:

```text
Chatbot nói trực tiếp với khách hàng thật

Tự động gọi hoặc nhắn tin cho khách

Lead generation

CRM hoàn chỉnh

Marketing automation

Tự động chốt đơn

Tự động nhận thanh toán

Autonomous sales agent
```

AI Customer chỉ tồn tại trong **môi trường luyện tập nội bộ**.

---

## 10. Tech Stack dự kiến

```text
Frontend       React
Backend        FastAPI
Agent Flow     LangGraph
LLM            Provider-agnostic
Database       PostgreSQL
Vector Search  pgvector
RAG            PostgreSQL + pgvector
Deploy         Vercel + Render
```

---

## 11. Định nghĩa thành công của MVP

MVP thành công khi chứng minh được ba giá trị chính:

```text
1. Tư vấn viên có thể tra cứu thông tin
   sản phẩm / chính sách có nguồn tham chiếu.

2. Tư vấn viên có thể luyện tập với
   AI Customer qua hội thoại nhiều lượt
   và nhận feedback sau phiên.

3. Quản lý có thể kiểm tra, phê duyệt
   hoặc chỉnh sửa kết quả do AI tạo.
```

Bộ kỹ năng, rubric, tiêu chí đánh giá và phương pháp đo độ tin cậy của hệ thống sẽ được nghiên cứu và xác định ở giai đoạn tiếp theo.
