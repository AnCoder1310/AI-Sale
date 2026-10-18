# Brief: VFO2O-20 — AI Agent Huấn luyện & hỗ trợ tư vấn viên bán xe (Sales Enablement)

**Sản phẩm:** VinFast AI Sales Coach & Copilot
**Đội:** 043Nova

## 1. Bài toán và giá trị sản phẩm

### 1.1. Copilot — pain points

Một sales phải trò chuyện và chăm sóc nhiều khách hàng cùng lúc, trong những cuộc trao đổi kéo dài qua nhiều ngày. Khi khách quay lại, sales có thể không nhớ khách là ai, đang quan tâm xe gì, ngân sách và điều kiện sử dụng ra sao, đã tư vấn đến đâu và còn việc gì cần làm.

- Hồ sơ nhu cầu nằm rải trong tin nhắn; phải đọc lại lịch sử dài hoặc hỏi lại khách.
- Câu hỏi chưa giải quyết, lời hứa gửi tài liệu/báo giá và lịch hẹn dễ bị bỏ sót.
- Thông số, giá, ưu đãi, pin/sạc và bảo hành cần đối chiếu đúng mẫu xe, phiên bản và ngày hiệu lực.
- Khi chưa biết câu trả lời, sales phải chuyển sang tài liệu hoặc công cụ AI ngoài luồng, nhập lại bối cảnh và tự kiểm tra nguồn.
- Khi bàn giao từ chatbot sang sales, thiếu bối cảnh có thể khiến khách phải nhắc lại thông tin. Đây là nhu cầu cho phần handoff còn cần tích hợp.

**Insight khảo sát do nhóm cung cấp:** nhân viên sale VinFast có sử dụng ChatGPT khi gặp câu hỏi chưa biết trong bài kiểm tra hoặc công việc tư vấn. Chưa có bản ghi khảo sát/số người tham gia đính kèm tài liệu này; không suy ra tần suất phổ biến hay mức tiết kiệm thời gian từ insight đó.

### 1.2. Roleplay — pain points

- Nhân viên mới có thể biết kiến thức nhưng chưa biết áp dụng vào hội thoại, khám phá nhu cầu và xử lý phản đối.
- Thiếu luyện tập có thể dẫn tới tư vấn sai, nói ngập ngừng hoặc thiếu tự tin trước khách thật, ảnh hưởng niềm tin và cơ hội bán hàng.
- Luyện trực tiếp cần quản lý hoặc đồng nghiệp có kinh nghiệm tham gia, phụ thuộc lịch và thời gian của họ.
- Muốn nhận xét sát nội dung, quản lý cần quan sát hoặc có transcript đủ chi tiết; lời kể lại của nhân viên chưa đủ.
- Thiếu đánh giá theo tiêu chí và lịch sử khiến nhân viên khó biết điểm yếu, quản lý khó chọn nội dung huấn luyện tiếp theo.

## 2. Người dùng

- **Sales Advisor:** chăm sóc nhiều khách, nắm lại bối cảnh, chuẩn bị câu trả lời và theo sát cam kết; luyện kỹ năng trước khi gặp khách thật.
- **Manager:** giao bài, xem transcript và đánh giá, duyệt/sửa kết quả, góp ý và theo dõi kỹ năng cần cải thiện.

## 3. Giải pháp

Hai phần phục vụ hai thời điểm: **Copilot hỗ trợ công việc tư vấn/chăm sóc khách; Roleplay hỗ trợ luyện tập và huấn luyện.**

### Feature 1 — Sales Copilot

| Nhu cầu | Giải pháp |
|---|---|
| Nhớ đúng từng khách sau nhiều ngày | Hội thoại theo khách, hồ sơ có cấu trúc và tóm tắt tình hình. |
| Nắm nhu cầu và điều kiện mua | Xe quan tâm, ngân sách, mục đích sử dụng, thanh toán/trả trước, thời điểm mua, điều kiện sạc và các mối quan tâm đã ghi nhận. |
| Biết đã trao đổi gì và còn vướng gì | Nội dung đã trao đổi, trạng thái còn mở/đã trả lời/đã xác nhận và lịch sử theo khách. |
| Kiểm tra bản tóm tắt | Tin nhắn nguồn; phân biệt dữ kiện ghi nhận, suy luận, mâu thuẫn và đã xác nhận; sales có thể sửa/xác nhận. |
| Chuẩn bị câu trả lời | Nháp dựa trên lịch sử khách và tài liệu VinFast, để sales kiểm tra và chỉnh sửa. |
| Xác minh thông tin sản phẩm | Tra cứu corpus có trích nguồn, đối chiếu mẫu xe/hiệu lực; hỏi làm rõ, trả lời một phần hoặc từ chối khi thiếu bằng chứng. |
| Theo sát cam kết | Công việc, lịch hẹn và trạng thái chăm sóc gắn với khách; đề xuất AI cần sales kiểm tra/xác nhận. |

**Giá trị hướng tới:** giảm công sức đọc lại và ghép thông tin, tiếp tục đúng bối cảnh, hạn chế bỏ sót việc và hỗ trợ câu trả lời phù hợp từng khách. Chưa đo mức tiết kiệm thời gian hoặc tỷ lệ giảm bỏ sót.

**Ranh giới hiện tại:** Customer Intelligence v2 cần bật cấu hình và khóa PII phù hợp. Chatbot website → sales còn cần tích hợp; chưa có đồng bộ Zalo/Facebook. Corpus MVP do nhóm chuẩn bị từ nguồn chính thức/công khai; tài liệu nội bộ chỉ được sử dụng khi được cấp quyền và nạp vào hệ thống. Chưa có so sánh tốc độ với ChatGPT.

### Feature 2 — AI Practice Coach

**Solution:** luyện nhiều lượt bằng chữ/giọng nói với khách AI theo tình huống VinFast; Mirror để tự quan sát phong thái; AI đánh giá theo rubric có dẫn chứng; manager xem transcript, duyệt/sửa, góp ý và giao bài tiếp.

**Giá trị hướng tới:** tăng cơ hội thực hành trước khi gặp khách thật và giúp quản lý tập trung vào kỹ năng cần huấn luyện. Mirror hiện không ghi hình hoặc tự chấm biểu cảm. Thời gian review, chi phí đào tạo và hiệu quả kinh doanh chưa được đo trước/sau.




Tư vấn viên chọn một tình huống trong thư viện hoặc bài được Manager giao, rồi chọn **Nhắn tin** hoặc **Gọi thoại**.

```text
Bác tài chạy dịch vụ cân nhắc đổi từ xe xăng sang VF 5 Plus   (Tiêu chuẩn)
Chị Hà — VF 6 Eco hay nâng lên Plus?                         (Tiêu chuẩn, luyện upsell)
Gia đình ở chung cư lo lắng hạ tầng sạc pin cho VF 6          (Cơ bản)
Khách hàng gia đình so sánh VF 7 Plus với Mazda CX-5          (Nâng cao)
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

Sau khi kết thúc phiên, hệ thống phân tích hội thoại và tạo đánh giá theo rubric `sales-rubric-v4` với năm chiều:

```text
Need Discovery
Product Knowledge
Objection Handling
Policy Accuracy
Closing / Next Step
```

Mỗi chiều có mô tả hành vi quan sát được, trạng thái áp dụng, thang điểm 1–3 và
dẫn chứng bằng lượt hội thoại. Nếu phiên không tạo cơ hội hợp lý để thể hiện một
kỹ năng, hoặc thiếu bằng chứng để kết luận, hệ thống ghi `UNASSESSED` với lý do
cụ thể thay vì tự gán điểm thấp.

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

### Copilot — tiếp tục chăm sóc một khách sau nhiều ngày

Mở danh sách khách → chọn đúng khách → đọc hồ sơ/tóm tắt và nội dung còn mở → kiểm tra tin nguồn, sửa/xác nhận dữ kiện nếu cần → tiếp tục hội thoại, tra cứu và chỉnh nháp trả lời → xác nhận công việc/lịch hẹn → cập nhật phân tích khi có tin mới.

Luồng dưới đây giữ mô tả tra cứu và luyện tập; tra cứu là một phần trong luồng Copilot theo khách.


```text
                     TƯ VẤN VIÊN
                          │
            ┌─────────────┴─────────────┐
            │                           │
     TRA CỨU KIẾN THỨC            LUYỆN TẬP
            │                           │
  Tra cứu trong không gian      Chọn tình huống / bài được giao
  khách hoặc Kho kiến thức              │
            │                   Nhắn tin hoặc Gọi thoại
       Tìm nguồn hiện tại               │
   (theo ngày hiệu lực)         AI Customer, hội thoại nhiều lượt
            │                           │
   Trả lời + citation               Kết thúc phiên
   → mở tài liệu gốc                    │
                                AI judge: bản nháp + dẫn chứng
                                + đối chiếu thông tin với nguồn
                                        │
                              Tự động lưu attempt
                                        │
                         Manager ưu tiên attempt mới nhất
                                        │
                         Phê duyệt / sửa điểm kèm lý do
                                        │
                  Tiến độ Advisor + bản đồ kỹ năng đội → giao bài tiếp
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

Hội thoại theo khách, hồ sơ và tóm tắt có tin nguồn

Hỏi đáp lịch sử và nháp trả lời theo bối cảnh khách

Công việc, lịch hẹn và theo dõi vấn đề còn mở

Tra cứu kiến thức có nguồn tham chiếu

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

Customer Intelligence, phân tích có phiên bản và nguồn tin nhắn

Service soạn nháp, dashboard và lịch biểu

Workflow tra cứu: RAG + nguồn tham chiếu

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

## 11. Định nghĩa thành công và bằng chứng cần đo

- **Copilot:** sales xem lại đúng khách, nắm hồ sơ/tóm tắt có nguồn, biết vấn đề còn mở và công việc cần làm; kiểm tra/chỉnh sửa nháp trả lời trước khi sử dụng.
- **Roleplay:** advisor hoàn thành hội thoại nhiều lượt, nhận đánh giá có evidence; manager kiểm tra, duyệt/sửa và giao bài tiếp; điểm năng lực dựa trên kết quả đã duyệt.
- **Đo giá trị trong pilot:** thời gian nắm lại bối cảnh; độ đúng của dữ kiện tóm tắt so với tin nguồn; tỷ lệ thực hiện đúng hạn cam kết; thời gian manager review; thay đổi kỹ năng theo rubric qua các lần luyện.

Các chỉ số trên là kế hoạch đo, chưa phải kết quả. Benchmark hỏi đáp Copilot không xác nhận chất lượng tóm tắt khách hay mức tiết kiệm thời gian. Benchmark roleplay/judge không tự chứng minh tăng doanh thu hoặc giảm chi phí đào tạo.

## 12. Định vị và so sánh

**Định vị:** nền tảng hỗ trợ sales VinFast vừa theo sát từng khách trong công việc, vừa luyện kỹ năng với đánh giá được quản lý kiểm duyệt.

### 12.1. Copilot so với cách dùng ChatGPT riêng lẻ

Đối chiếu với cách sales mở một cuộc chat ChatGPT riêng để hỏi thông tin hoặc nhờ soạn câu trả lời. Bảng nêu điểm mạnh của P-043 trong quy trình VinFast, không coi đây là so sánh với mọi cấu hình ChatGPT hoặc hệ thống được xây thêm trên ChatGPT.

| Tiêu chí so sánh | Điểm mạnh của Copilot P-043 |
|---|---|
| Tổ chức công việc theo từng khách | Không gian hội thoại gắn với hồ sơ, lịch sử, tóm tắt và công việc của đúng khách. |
| Nắm lại bối cảnh sau nhiều ngày | Tóm tắt tình hình, xe quan tâm, ngân sách, nhu cầu, nội dung đã trao đổi và câu hỏi còn mở. |
| Kiểm tra thông tin khách | Dẫn về tin nhắn nguồn, phân biệt dữ kiện ghi nhận/suy luận/mâu thuẫn/đã xác nhận và cho sales sửa hoặc xác nhận. |
| Tra cứu kiến thức VinFast | Corpus được chuẩn bị cho sản phẩm/chính sách VinFast; trả lời có nguồn và đối chiếu mẫu xe, phiên bản, hiệu lực khi có dữ liệu. |
| Chuẩn bị phản hồi phù hợp khách | Nháp trả lời kết hợp lịch sử hội thoại với tài liệu VinFast, để sales kiểm tra và chỉnh sửa. |
| Theo sát việc đã hứa | Công việc, lịch hẹn và trạng thái chăm sóc gắn với khách trong cùng không gian làm việc. |

**Thông điệp trình bày:** “So với cách hỏi ChatGPT trong một cuộc chat riêng, Copilot của chúng tôi tổ chức hỗ trợ theo từng khách hàng: nắm bối cảnh, kiểm tra nguồn, chuẩn bị phản hồi và theo dõi việc cần làm trong cùng luồng tư vấn VinFast.”

### 12.2. Roleplay so với các nền tảng roleplay khác

Nhóm tham chiếu: các nền tảng luyện hội thoại AI như Yoodli và Second Nature. Bảng tập trung vào thế mạnh P-043 mang tới cho đội sales VinFast.

| Tiêu chí so sánh | Điểm mạnh của Roleplay P-043 |
|---|---|
| Bối cảnh thực hành | Chuẩn bị sẵn tình huống tư vấn xe VinFast: khách chạy dịch vụ, so sánh VF 7 với CX-5, sạc tại chung cư và lựa chọn Eco/Plus. |
| Vận dụng kiến thức chuyên ngành | Kết nối thực hành với thông số xe, kiến thức pin/sạc và kiểm tra phát biểu về chính sách bằng corpus. |
| Tiêu chí đánh giá phù hợp công việc | Rubric gồm khám phá nhu cầu, kiến thức sản phẩm, xử lý phản đối, chính xác chính sách và chốt/bước tiếp theo. |
| Căn cứ để góp ý | Transcript và dẫn chứng gắn với đánh giá giúp sales và manager xem lại nội dung cụ thể. |
| Vai trò của manager | Manager xem lịch sử/transcript, sửa hoặc duyệt bản đánh giá AI và ghi nhận lý do khi điều chỉnh điểm. |
| Huấn luyện tiếp nối | Giao bài và theo dõi kỹ năng từ kết quả đã được manager duyệt. |
| Cách thực hành | Hội thoại chữ/giọng nói và Mirror để tự quan sát phong thái khi nói. |
| Liên kết với công việc tư vấn | Nằm cùng sản phẩm với Copilot và kho kiến thức VinFast phục vụ công việc hằng ngày. |

**Thông điệp trình bày:** “Khi lựa chọn một nền tảng roleplay cho đội sales VinFast, thế mạnh của P-043 là tình huống và kiến thức chuyên biệt, đánh giá có dẫn chứng, cùng quy trình để quản lý duyệt kết quả và tiếp tục huấn luyện từng nhân viên.”

### 12.3. Nguồn tham chiếu cho phần so sánh

Tham khảo ngày 18/10/2026: [ChatGPT Projects](https://help.openai.com/en/articles/10169521-projects-in-chatgpt), [Yoodli Roleplay Builder](https://support.yoodli.ai/en/articles/11565137-how-to-build-and-customize-roleplays), [Yoodli Custom Goals](https://support.yoodli.ai/en/articles/11556965-creating-custom-goals), [Second Nature](https://secondnature.ai/).

Bảng mô tả điểm mạnh và mức phù hợp của P-043; không sử dụng dấu “không có” cho đối thủ hoặc tuyên bố tính độc quyền. Căn cứ cho tính năng P-043: `src/models/sales_copilot.py`, `src/models/customer_intelligence.py`, `frontend/src/components/copilot/customerWorkspace/`, `data/scenarios/scenarios.json`, `src/agents/roleplay/evaluator.py`, `src/api/recorded_practice.py`. Phạm vi triển khai và phép đo hiệu quả được giữ riêng tại §3 và §11.

## 13. Tính khả thi về chi phí vận hành

Theo định mức 10 phiên Roleplay voice/nhân viên/tuần, 10 lượt/phiên và 40 giây nói/lượt, dự toán Roleplay khoảng **1,79 USD/người/tháng**. Cộng mức sử dụng Sales Copilot trong phương án ngân sách, tổng API khoảng **3,98 USD/người/tháng**; mức phân bổ có 30% dự phòng là **5,18 USD/người/tháng**.

Kịch bản sử dụng cao **15 phiên/người/tuần**: Roleplay **2,68 USD/người/tháng**, tổng cùng Copilot **4,88 USD**, ngân sách có 30% dự phòng **6,34 USD**. Workload Copilot giữ nguyên; tần suất luyện là định mức ngân sách, không phải quota phần mềm.

Ngân sách bao gồm LLM, evaluator sản phẩm, Jev/embedding, STT/TTS và phân bổ phí credits OpenRouter; không tính hosting, phần cứng, benchmark/test hoặc thuế. Đơn giá được đối chiếu nguồn nhà cung cấp ngày 18/10/2026. Định mức token và tần suất Copilot là cơ sở dự toán, chưa phải chi phí thực đo hay kết quả khảo sát. Xem [bảng chi phí và workload đầy đủ](../operating-costs.md).
