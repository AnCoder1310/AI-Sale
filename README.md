# P-043 — AI Sales Coach cho tư vấn viên VinFast

MVP gồm **Copilot** tra cứu kiến thức xe/chính sách có trích nguồn và **Practice Room** trò chuyện nhiều lượt với AI Customer, nhận đánh giá có dẫn chứng từ transcript. Advisor xem lịch sử và bài được giao; manager giao kịch bản, xem hàng đợi, transcript, duyệt/sửa đánh giá và theo dõi năng lực đội ngũ từ các bài đã duyệt. Đây là sản phẩm học tập dùng corpus công khai và khách hàng giả lập, không phải kênh công bố chính sách chính thức của VinFast.

## Chạy local

**Docker:** `docker compose up --build` chạy frontend, backend và PostgreSQL + pgvector local. Xem [hướng dẫn Docker](docs/local-docker.md) để seed tài khoản và lưu dữ liệu. Mỗi máy có database riêng; muốn chia sẻ dữ liệu cần triển khai backend dùng chung với PostgreSQL hosted.

Nhánh triển khai Neon dùng Render cho backend và Vercel cho frontend; xem [hướng dẫn triển khai](docs/deployment.md). Chỉ mở PR vào `develop` sau khi kiểm tra deployment thật.

Cần Python 3.11, Node.js tương thích Vite 8, npm và OpenRouter API key có quyền gọi chat/embedding. Lời gọi thật có thể phát sinh phí.

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Điền `OPENROUTER_API_KEY` trong `.env`. Mặc định chat dùng `OPENROUTER_MODEL_NAME=openai/gpt-6-luna`, embedding dùng `EMBEDDING_MODEL_NAME=openai/text-embedding-3-small` qua OpenRouter; **hai tác vụ model khác nhau**, không dùng hash cho demo thật. Khi chạy Python trực tiếp, `DATABASE_URL=sqlite:///./data/app.db` lưu user, phiên, transcript và đánh giá; `CHROMA_PERSIST_DIR=./data/chroma` lưu vector index dẫn xuất từ `data/knowledge/corpus.json`. Docker Compose ghi đè hai mặc định này để dùng PostgreSQL + pgvector. Đổi embedding model thì tạo collection mới và ingest lại. Không commit `.env`, mật khẩu hoặc database local.

Trong `.env`, đặt `DEMO_ADVISOR_PASSWORD` và `DEMO_MANAGER_PASSWORD` riêng, rồi seed tài khoản local:

```bash
python -c 'import asyncio; from dotenv import load_dotenv; load_dotenv(); from scripts.seed_demo_users import seed; asyncio.run(seed())'
```

Đăng nhập bằng `advisor.demo` và `manager.demo`. Seed script cập nhật hai tài khoản demo cố định khi chạy lại; không dùng với tài khoản thật. Trên nhánh triển khai này, manager có thể tạo tài khoản Advisor trong tab **Tài khoản**; môi trường production dùng bootstrap manager và bắt buộc đổi mật khẩu khởi tạo.

Chạy hai terminal từ thư mục gốc repo:

```bash
source .venv/bin/activate
uvicorn src.main:app --reload --port 8000
```

```bash
cd frontend
npm ci
npm run dev
```

Mở <http://localhost:3000>. Vite proxy `/api` và `/health` sang cổng 8000; Swagger ở <http://localhost:8000/docs>. Lần khởi động đầu ingest corpus nếu Chroma rỗng. `/health` trả 200 **không chứng minh** Copilot/provider hoạt động; cần gửi câu hỏi thật. Nếu không dùng Vite proxy, cấu hình `CORS_ORIGINS` tương ứng frontend origin.

## Luồng demo và câu hỏi mẫu

Practice Room có **Chế độ nói** tùy chọn: giữ micro để nói tiếng Việt, sửa bản chép rồi gửi, nghe phản hồi của AI Customer bằng giọng WaveNet. Xem [cấu hình Voice Mode](docs/voice-mode.md); Text Mode vẫn chạy khi chưa có key giọng nói.

1. Đăng nhập Advisor. Hỏi Copilot: **“Giá niêm yết VF 8 Thế hệ mới theo bảng giá VinFast là bao nhiêu?”** Mở citation. Câu ngoài kho: **“Giá bảo hiểm chính xác của đại lý X ngày mai là bao nhiêu?”** phải không tự bịa.
2. Vào Practice Room, chọn **VF 5 Plus — khách chạy dịch vụ**. Hỏi quãng đường/ngày, tiền xăng Vios thực tế và giờ nghỉ/sạc; xử lý lo ngại chi phí, tránh cam kết tiết kiệm khi chưa đủ dữ liệu. Kết thúc để xem điểm AI dự thảo, transcript evidence và lịch sử.
3. Đăng xuất, đăng nhập Manager. Vào **Giao bài**, chọn Advisor và kịch bản rồi đặt hạn. Đăng nhập lại Advisor, bắt đầu bài trong Practice Room và hoàn thành phiên. Đăng nhập Manager để thấy trạng thái hoàn thành.
4. Manager xem hàng đợi và transcript, nhập lý do khi duyệt; vào **Năng lực** để xem điểm kỹ năng từ các phiên đã duyệt. Advisor chưa có ít nhất 3 phiên được duyệt và có điểm sẽ chưa được xếp hạng.

Bài được giao chỉ hoàn thành khi một phiên Practice bắt đầu từ chính bài đó được đánh giá thành công. Một phiên tự luyện cùng kịch bản không tự hoàn thành bài được giao. Dữ liệu bài tập và điểm đội ngũ lưu trong database; không có hồ sơ hoặc điểm giả trên màn hình.

Không biến giá niêm yết thành “giá lăn bánh” hay tự suy ra mọi VF 5 phải thuê pin. Nếu provider lỗi, UI cần cho retry; không mô tả sai là “không có tài liệu”.

## Kiến trúc, kiểm thử và bằng chứng

Xem [sơ đồ kiến trúc](docs/architecture_diagram.md). React/Vite gọi FastAPI bằng cookie phiên; Copilot dùng LangGraph, hybrid retrieval, vector index và OpenRouter. Practice dùng LangGraph giữ trạng thái, AI Customer, evaluator rubric có evidence và manager HITL. Docker dùng PostgreSQL + pgvector local; chạy Python trực tiếp mặc định SQLite + Chroma. Dữ liệu trên ổ local **không tự bền vững** khi deploy lên filesystem tạm.

```bash
ruff check src tests
ruff format --check src tests
pytest tests -q
cd frontend && npm run lint && npm run build
```

Kiểm thử phần mềm khác đánh giá AI. [Báo cáo Gate 2](eval/results/gate2_manual_cases_2026-10-04.md) ghi 5 ca thủ công với input, output quan sát, expected và giới hạn. [Benchmark Copilot 50 case](eval/datasets/copilot_benchmark.json) là tập rộng hơn, **không tự chứng minh 50 lời gọi thật đã chạy**. Các smoke trước nằm trong `eval/results/`. Trạng thái GitHub Actions phải xem trên PR; job không bắt đầu không phải CI pass.

Feature branch → PR `develop` → kiểm tra/review → PR `develop` → `main` khi đủ điều kiện. Không push trực tiếp vào `main`. [Kịch bản video Gate 2](presentation/GATE2_DEMO.md) mô tả 3 phút cần quay. AI usage log, Git worklog và eval evidence là các bằng chứng riêng; không trộn với file chứa key.

| Thành viên | MSSV |
| --- | --- |
| Phạm Đình Duy | 2A202602913 |
| Phạm Quốc Đạt | 2A202602384 |
| Võ Trường An | 2A20262656 |
| Nguyễn Hữu Chương | 2A202602601 |
