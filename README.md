# P-043 — AI Sales Coach cho tư vấn viên VinFast

**Live URL:** https://aisale.itup.io.vn/ (URL do nhóm cung cấp; cấu hình triển khai xem [hướng dẫn triển khai](docs/deployment.md)).

TODO (team): ảnh chụp màn hình Practice Room / Copilot / Manager.

Ảnh trong [báo cáo UI evidence](report/roleplay-supervisor-showcase-with-ui-evidence.html) được ghi rõ là prototype/UI concept; cần bổ sung ảnh ứng dụng hiện tại để đáp ứng mục screenshot.

## Vấn đề

Tư vấn viên VinFast mới phải nhớ lượng lớn thông số xe, chính sách pin/sạc, giá và biểu phí, nhưng khó tra cứu nhanh có nguồn khi đang nói chuyện với khách. Họ cũng ít cơ hội luyện xử lý từ chối và lo ngại chi phí với nhiều kiểu khách khác nhau, còn quản lý khó chấm và theo dõi năng lực từng người một cách nhất quán.

## Giải pháp

MVP gồm **Copilot** tra cứu kiến thức xe/chính sách có trích nguồn và **Practice Room** trò chuyện nhiều lượt với AI Customer, nhận đánh giá có dẫn chứng từ transcript. Advisor xem lịch sử và bài được giao; manager giao kịch bản, xem hàng đợi, transcript, duyệt/sửa đánh giá và theo dõi năng lực đội ngũ từ các bài đã duyệt. Đây là sản phẩm học tập dùng corpus công khai và khách hàng giả lập, không phải kênh công bố chính sách chính thức của VinFast.

- **Copilot:** trả lời có trích nguồn từ corpus công khai, từ chối khi thiếu bằng chứng.
- **Practice Room:** tư vấn viên mở lời trước, AI Customer phản hồi nhiều lượt (chat chữ hoặc giọng nói), AI judge riêng chấm theo rubric kèm evidence.
- **Manager console:** giao bài, duyệt/sửa đánh giá, xem năng lực đội.

## Tech Stack

- **Frontend:** React 19, Vite 8 (Caddy khi chạy Docker, Vercel khi hosted).
- **Backend:** Python 3.11, FastAPI, LangGraph/LangChain, SQLAlchemy.
- **AI:** OpenRouter (chat và embedding), hybrid retrieval (vector + BM25), LangSmith tùy chọn; giọng nói dùng Groq Whisper và Google WaveNet.
- **Dữ liệu:** PostgreSQL + pgvector (Docker/hosted) hoặc SQLite + Chroma (chạy trực tiếp).
- **Triển khai:** Docker Compose; Render (backend) và Vercel (frontend).

Kiến trúc chi tiết: [ARCHITECTURE.md](ARCHITECTURE.md) và [sơ đồ kiến trúc](docs/architecture_diagram.md).

```mermaid
flowchart LR
  A[Advisor / Manager] --> UI[React + Vite]
  UI -->|REST + cookie| API[FastAPI]
  API --> CP[Copilot LangGraph]
  API --> RP[Practice LangGraph]
  CP --> RET[Hybrid retrieval] --> VEC[(pgvector / Chroma)]
  CP --> LLM[OpenRouter]
  RP --> LLM
  RP --> JUDGE[Evaluator rubric v4]
  JUDGE --> JM[OpenRouter judge riêng]
  JUDGE --> RET
  API --> HITL[Manager review / approval] --> SQL
  RP --> SQL[(PostgreSQL / SQLite)]
  API -->|STT / TTS| V[Groq Whisper / Google WaveNet]
```

## Setup

### Chạy local

Sau khi tạo `.env` và điền các biến ở phần dưới, chọn chạy Python trực tiếp hoặc Docker. Mỗi máy có database riêng; muốn chia sẻ dữ liệu cần backend và PostgreSQL hosted dùng chung.

Mô hình triển khai được mô tả là Render cho backend, Vercel cho frontend và Neon cho PostgreSQL + pgvector; xem [hướng dẫn triển khai](docs/deployment.md). Mô tả tính năng trong README phản ánh mã trên nhánh hiện tại; không khẳng định các thay đổi chưa merge đã có trên bản live. URL ở đầu README không xác nhận trạng thái backend hoặc uptime.

Cần Python 3.11, Node.js 22 tương thích Vite 8 (Docker dùng Node 22), npm và OpenRouter API key có quyền gọi chat/embedding. Lời gọi thật có thể phát sinh phí.

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.lock
cp .env.example .env
```

Điền `OPENROUTER_API_KEY` trong `.env`; không commit key, mật khẩu hoặc database local. Tên biến cần biết (không ghi giá trị credential vào tài liệu):

| Nhóm | Biến môi trường |
| --- | --- |
| Sinh hội thoại / embedding | `LLM_PROVIDER`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL_NAME`, `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL_NAME` |
| Judge độc lập | `PRACTICE_JUDGE_PROVIDER`, `PRACTICE_JUDGE_MODEL` |
| Persistence | `DATABASE_URL`, `VECTOR_STORE_TYPE`, `CHROMA_PERSIST_DIR`, `CHROMA_COLLECTION_NAME` |
| Web / phiên | `APP_ENV`, `CORS_ORIGINS`, `AUTH_COOKIE_SECURE`, `AUTH_SESSION_TTL_HOURS` |
| Tài khoản local | `DEMO_ADVISOR_PASSWORD`, `DEMO_MANAGER_PASSWORD` |
| Bootstrap production | `BOOTSTRAP_MANAGER_USERNAME`, `BOOTSTRAP_MANAGER_DISPLAY_NAME`, `BOOTSTRAP_MANAGER_PASSWORD` |
| Voice tùy chọn | `GROQ_API_KEY`, `GOOGLE_TTS_SERVICE_ACCOUNT_JSON` |
| Trace tùy chọn | `LANGSMITH_TRACING`, `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT`, `LANGSMITH_CAPTURE_CONTENT` |
| Docker / hosted frontend | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `FRONTEND_PORT`, `RENDER_BACKEND_URL` |

Theo [cấu hình Python](src/config.py), generator mặc định là `openai/gpt-6-luna`, embedding là `openai/text-embedding-3-small` qua OpenRouter. Judge mặc định dùng provider OpenRouter và model `google/gemini-3.8-flash`, temperature 0; runtime không cho judge trùng cả provider lẫn model với generator. Chạy trực tiếp mặc định SQLite ở `data/app.db` và Chroma ở `data/chroma`. Đổi embedding model cần reindex phù hợp. Xem [.env.example](.env.example) và [hướng dẫn database](docs/database-backends.md).

Trong `.env`, đặt `DEMO_ADVISOR_PASSWORD` và `DEMO_MANAGER_PASSWORD` riêng, rồi seed tài khoản local:

```bash
python -m scripts.seed_demo_users
```

Đăng nhập bằng `advisor.demo` và `manager.demo`. Seed script cập nhật hai tài khoản demo cố định khi chạy lại; không dùng với tài khoản thật. Trong mã hiện tại, manager có thể tạo tài khoản Advisor trong tab **Tài khoản**; môi trường production dùng bootstrap manager và bắt buộc đổi mật khẩu khởi tạo.

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

### Chạy Docker

```bash
docker compose up --build -d
docker compose exec backend python -m scripts.seed_demo_users
```

[docker-compose.yml](docker-compose.yml) chạy Caddy + React, FastAPI và PostgreSQL + pgvector; mở <http://localhost:3000>. Volume `postgres_data` giữ SQL và vector, `index_manifests` giữ manifest. Compose chỉ publish cổng frontend; Swagger qua proxy ở <http://localhost:3000/docs> **không được cấu hình**. Để xem Swagger, dùng cách chạy local cổng 8000 ở trên hoặc thêm port mapping backend trong cấu hình riêng.

Lưu ý cấu hình hiện tại: Compose đặt mặc định generator là `google/gemini-2.0-flash-001`, khác mặc định Python; đặt `OPENROUTER_MODEL_NAME` trong `.env` để chọn rõ model. Compose chưa chuyển tiếp `PRACTICE_JUDGE_PROVIDER` và `PRACTICE_JUDGE_MODEL`: judge trong container dùng mặc định Python. Muốn đổi judge, bổ sung hai tên biến vào `backend.environment` trong cấu hình Compose riêng. Không chỉ sửa `.env` rồi cho rằng container đã nhận chúng.

### Luồng demo và câu hỏi mẫu

Practice Room hỗ trợ push-to-talk: giữ micro tối đa 90 giây, thả để Groq Whisper chép tiếng Việt. Công tắc **Tự động gửi** quyết định gửi ngay bản chép hay sửa trước khi nhấn Gửi; phản hồi AI Customer có thể được đọc bằng Google WaveNet. Hộp nhập chữ vẫn hiện trong cả hai chế độ. Xem [cấu hình Voice Mode](docs/voice-mode.md); chat chữ vẫn chạy khi chưa có key giọng nói.

Bốn kịch bản hiện có trong [scenarios.json](data/scenarios/scenarios.json):

| ID | Nội dung |
| --- | --- |
| `SCENARIO_01_VF5_TAXI` | Khách chạy dịch vụ cân nhắc VF 5 Plus |
| `SCENARIO_02_VF7_VS_CX5` | Gia đình so sánh VF 7 Plus với Mazda CX-5 |
| `SCENARIO_03_VF6_APARTMENT` | Gia đình ở chung cư lo hạ tầng sạc cho VF 6 |
| `SCENARIO_04_VF6_ECO_PLUS_UPSELL` | Chị Hà cân nhắc VF 6 Eco hay nâng lên Plus |

Kịch bản 04 chấp nhận cả `close_eco` và `upsell_plus`; upsell là kết quả ưu tiên, không phải kết quả duy nhất hợp lệ. Evaluator chung đọc cấu hình từng scenario và `policy_expectations`, dùng `sales-rubric-v4` với 5 tiêu chí: khám phá nhu cầu, kiến thức sản phẩm, xử lý phản đối, chính xác chính sách, chốt / bước tiếp theo. Tiêu chí được đánh giá có điểm 1–3 và quote/message ID từ transcript; thiếu cơ hội/bằng chứng có thể là `unassessed`, không tự gán điểm. Xem [evaluator](src/agents/roleplay/evaluator.py) và [prompt rubric](src/agents/roleplay/prompts/evaluator.py).

Guardrail hai lớp gồm [lọc cục bộ](src/agents/roleplay/guardrails.py) trước lời gọi model và cờ `unsafe_or_abusive` của analyzer. Vi phạm dẫn tới `advisor_misconduct`, dừng hội thoại; evaluator ép điểm đã chấm về 1. Lỗi Practice có mã ổn định và thông báo tiếng Việt từ [practice_errors.py](src/api/practice_errors.py), được UI ánh xạ thành notice dialog với hành động phù hợp như thử lại hoặc đăng nhập.

1. Đăng nhập Advisor. Hỏi Copilot: **“Giá niêm yết VF 8 Thế hệ mới theo bảng giá VinFast là bao nhiêu?”** Mở citation. Câu ngoài kho: **“Giá bảo hiểm chính xác của đại lý X ngày mai là bao nhiêu?”** phải không tự bịa.
2. Vào Practice Room, chọn **VF 5 Plus — khách chạy dịch vụ**. Tư vấn viên mở lời chào khách trước; khách phản hồi theo nhu cầu của kịch bản. Hỏi quãng đường/ngày, tiền xăng Vios thực tế và giờ nghỉ/sạc; xử lý lo ngại chi phí, tránh cam kết tiết kiệm khi chưa đủ dữ liệu. Kết thúc để xem điểm AI dự thảo, transcript evidence và lịch sử.
3. Đăng xuất, đăng nhập Manager. Vào **Giao bài**, chọn Advisor và kịch bản rồi đặt hạn. Đăng nhập lại Advisor, bắt đầu bài trong Practice Room và hoàn thành phiên. Đăng nhập Manager để thấy trạng thái hoàn thành.
4. Manager xem hàng đợi và transcript, nhập lý do khi duyệt; vào **Năng lực** để xem điểm kỹ năng từ các phiên đã duyệt. Advisor chưa có ít nhất 3 phiên được duyệt và có điểm sẽ chưa được xếp hạng.

Bài được giao chỉ hoàn thành khi một phiên Practice bắt đầu từ chính bài đó được đánh giá thành công. Một phiên tự luyện cùng kịch bản không tự hoàn thành bài được giao. Dữ liệu bài tập và điểm đội ngũ lưu trong database; không có hồ sơ hoặc điểm giả trên màn hình.

Không biến giá niêm yết thành “giá lăn bánh” hay tự suy ra mọi VF 5 phải thuê pin. Nếu provider lỗi, UI cần cho retry; không mô tả sai là “không có tài liệu”.

### Giám sát Copilot

Dùng `.venv` làm môi trường Python chính. Dependency trực tiếp nằm trong `requirements.txt`; local, CI và Docker cài phiên bản chính xác từ `requirements.lock`. CI cấu hình Python 3.11. Cấu hình LangSmith qua các biến `LANGSMITH_*` trong `.env.example`; mỗi request Copilot có `X-Request-ID` để tìm log và trace.

### Kiến trúc, kiểm thử và bằng chứng

Xem [sơ đồ kiến trúc](docs/architecture_diagram.md) và [hướng dẫn Database](docs/database-backends.md). React/Vite gọi FastAPI bằng cookie phiên; Copilot dùng LangGraph, hybrid retrieval, vector index và OpenRouter. Practice dùng LangGraph giữ trạng thái, AI Customer, evaluator rubric có evidence và manager HITL. Docker dùng PostgreSQL + pgvector local; chạy Python trực tiếp mặc định SQLite + Chroma (hoặc PostgreSQL hosted khi cấu hình `DATABASE_URL`). Dữ liệu trên ổ local **không tự bền vững** khi deploy lên filesystem tạm.

```bash
ruff check src tests
ruff format --check src tests
pytest tests -q
cd frontend && npm run lint && npm run build
```

Workflow [CI](.github/workflows/ci.yml) chạy Ruff và pytest backend trên push/PR vào `main`/`develop`; lint/build frontend và kiểm tra format ở trên là kiểm tra riêng, chưa nằm trong workflow này.

Kiểm thử phần mềm khác đánh giá AI. [Báo cáo Gate 2](eval/results/gate2_manual_cases_2026-10-04.md) ghi 5 ca thủ công với input, output quan sát, expected và giới hạn. [Benchmark Copilot 50 case](eval/datasets/copilot_benchmark.json) là tập rộng hơn, **không tự chứng minh 50 lời gọi thật đã chạy**. Các smoke trước nằm trong `eval/results/`. Trạng thái GitHub Actions phải xem trên PR; job không bắt đầu không phải CI pass.

Feature branch → PR `develop` → kiểm tra/review → PR `develop` → `main` khi đủ điều kiện. Không push trực tiếp vào `main`. [Kịch bản video Gate 2](presentation/GATE2_DEMO.md) mô tả 3 phút cần quay. AI usage log, Git worklog và eval evidence là các bằng chứng riêng; không trộn với file chứa key.

## Cấu trúc thư mục

```text
.
├── src/                 # FastAPI, agents, services, integrations, knowledge
├── frontend/            # React/Vite, API client, giao diện Advisor/Manager
├── data/                # Scenario JSON, corpus và dữ liệu local
├── tests/               # Kiểm thử backend
├── eval/                # Dataset và kết quả đánh giá AI
├── docs/                # Đặc tả, triển khai, database, voice
├── scripts/             # Seed và tiện ích vận hành
├── report/              # Bằng chứng / báo cáo demo
├── presentation/        # Kịch bản trình diễn
├── .github/workflows/   # CI
├── Dockerfile
├── docker-compose.yml
└── ARCHITECTURE.md
```

## Team

MSSV theo [WORKLOG.md](WORKLOG.md); phạm vi công việc theo [phân công nhóm](docs/project-management/Task_division.md).

| Thành viên | MSSV | Phạm vi phụ trách được ghi trong repo |
| --- | --- | --- |
| Phạm Đình Duy | 2A202602913 | AI Customer, scenario runtime, Practice backend, coaching/evaluator |
| Phạm Quốc Đạt | 2A202602384 | Data, evaluation, benchmark, calibration |
| Võ Trường An | 2A202602656 | Frontend, UX, tích hợp API phía client |
| Nguyễn Hữu Chương | 2A202602601 | Copilot, shared backend, RAG, persistence/runtime |

**Trách nhiệm:** TODO (team): Khi kết quả chấm sai…, người chịu trách nhiệm là…
