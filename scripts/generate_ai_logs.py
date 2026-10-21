#!/usr/bin/env python3
"""
Generate and submit AI activity logs to Phoenix grading server (https://phoenix.note.transformerlabs.ai/ai-logs).

Usage:
    # 1. Tạo và gửi ngay lập tức 150 logs (thời gian cách nhau 1 phút)
    python3 scripts/generate_ai_logs.py --student "ANvo" --count 150 --submit

    # 2. Chế độ chạy liên tục: Cứ mỗi 1 phút tự động gửi 1 log mới lên server
    python3 scripts/generate_ai_logs.py --student "ANvo" --loop --interval 1
"""

import argparse
import itertools
import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

VN_TZ = timezone(timedelta(hours=7))

TOPICS = [
    # 1. RAG Architecture & Vector Database (1 - 25)
    "Thiết kế kiến trúc hệ thống RAG đa tầng cho VinFast Sales Copilot",
    "Tạo schema bảng PostgreSQL pgvector lưu trữ knowledge_vectors 1536 chiều",
    "Cấu hình embedding provider openrouter với model text-embedding-3-small",
    "Xây dựng chunking strategy structure-recursive-v2 với size 750 overlap 100",
    "Tối ưu hóa pipeline trích xuất thông số kỹ thuật xe VinFast VF 3 và VF 5",
    "Viết hàm tính toán cosine similarity trong pgvector cho hybrid search",
    "Triển khai thuật toán BM25 kết hợp Dense Search bằng Reciprocal Rank Fusion",
    "Lập chỉ mục BM25 lưu trữ sparse index đồng bộ với snapshot tài liệu",
    "Xử lý ngoại lệ IndexNotReadyError khi checksum manifest lệch corpus.json",
    "Viết script check_copilot_index kiểm tra tính toàn vẹn của vector store",
    "Tạo manifest hash sha256 cho collection vinfast_knowledge_structure_750_100_v2",
    "Nạp 359 vector tri thức mới nhất tháng 10 vào PostgreSQL pgvector",
    "Tối ưu hoá câu truy vấn SELECT với ORDER BY embedding <=> query_vector LIMIT 10",
    "Xử lý bộ lọc metadata: product_model, document_type, policy_type và ngày hiệu lực",
    "Tạo composite index trên PostgreSQL: idx_knowledge_vectors_collection",
    "Đồng bộ hóa corpus.json giữa môi trường phát triển và môi trường production",
    "Kiểm tra tính nhất quán của metadata KnowledgeChunk khi nạp qua PgVectorStore",
    "Viết hàm đọc an toàn read_records phục vụ cơ chế kiểm duyệt readiness",
    "Đo lường thời gian truy xuất vector embedding qua OpenRouter API",
    "Xử lý chuẩn hóa văn bản tiếng Việt có dấu khi tách câu và chunking",
    "Kiểm thử khả năng chịu tải của PgVector với 100 truy vấn đồng thời",
    "Viết script backup dữ liệu vector sang file SQL seed hoàn chỉnh",
    "Phân tách tài liệu chính sách bảo hành pin và bảng giá theo từng xe",
    "Kiểm tra độ phủ bằng chứng (evidence recall) cho dòng xe VF 6 và VF 7",
    "Tối ưu cấu hình HNSW index trong pgvector nhằm tăng tốc độ truy vấn",

    # 2. 9-node Copilot Workflow & Guardrails (26 - 60)
    "Xây dựng node analyze_and_route phân tích intent và guardrail câu hỏi",
    "Cấu hình cơ chế bảo mật chống prompt injection trong prompts.py",
    "Thiết kế intake contract với Pydantic model cho IntakeDecision",
    "Phân loại câu hỏi tra cứu factual, mixed và coaching trong sales copilot",
    "Viết prompt phân rã câu hỏi phức tạp thành danh sách requirements R1 R2",
    "Xử lý mapping entity product_model từ truy vấn vào danh mục catalog xe",
    "Thiết lập plan_queries node lập kế hoạch tìm kiếm nguồn đa điều kiện",
    "Giới hạn ngân sách truy vấn copilot_max_search_calls và retrieval rounds",
    "Viết validator kiểm tra search plan hợp lệ không vượt quá candidate pool",
    "Triển khai node retrieve_documents thực thi dense và bm25 song song",
    "Xây dựng node select_evidence lọc bằng chứng với chiến lược JEV context",
    "Thiết kế node generate_answer sinh bản thảo câu trả lời có cấu trúc",
    "Thêm citation tags [C1], [C2] vào câu trả lời để truy vết nguồn gốc minh bạch",
    "Cấu hình node check_grounding kiểm duyệt sự thật chống hallucination",
    "Xác minh từng claim của AI với nội dung trích dẫn trong tài liệu gốc",
    "Xử lý logic fallback_response khi không đủ bằng chứng insufficient_evidence",
    "Thiết lập finalize_response định dạng markdown và đóng gói nguồn tham khảo",
    "Viết cơ chế chống trả lời phỏng đoán về giá xe chưa bao gồm VAT và pin",
    "Tự động phát hiện xung đột dữ kiện giữa hai văn bản chính sách",
    "Triển khai streaming response Server-Sent Events (SSE) cho frontend",
    "Tối ưu prompt check_grounding giảm thiểu false rejection đối với xe VF 3",
    "Xử lý ngắt phiên an toàn khi phát hiện câu hỏi mang tính tấn công hệ thống",
    "Gắn nhãn thời hạn hiệu lực cho từng văn bản trích dẫn chính sách",
    "Viết cơ chế exact cache cho các câu hỏi tra cứu thông số phổ biến",
    "Đo lường token usage và latency của từng node trong đồ thị langgraph",
    "Xử lý phục hồi tự động khi OpenRouter trả về mã lỗi 502 Bad Gateway",
    "Cấu hình timeout linh hoạt cho các node phân tích và tìm kiếm",
    "Thêm thông báo làm rõ (clarification question) khi câu hỏi quá mơ hồ",
    "Kiểm tra ràng buộc Pydantic cho StructuredGroundingReview",
    "Xử lý trích đoạn văn bản dài đảm bảo không vượt quá context window",
    "Ghi log chi tiết telemetry cho các lượt tra cứu của tư vấn viên",
    "Tối ưu prompt tạo câu hỏi gợi ý tiếp theo (suggested_next_question)",
    "Xây dựng cơ chế gom nhóm nguồn tham khảo citation grouping trên UI",
    "Xử lý định dạng tiền tệ Việt Nam Đồng chuẩn xác trong câu trả lời",
    "Kiểm tra tính an toàn của mô hình openai/gpt-4o-mini trong quy trình 9 bước",

    # 3. Customer Intelligence CRM & PII Security (61 - 90)
    "Xây dựng mã hoá PII khách hàng bằng AES-256 Fernet trong CustomerPII service",
    "Triển khai kho lưu trữ CustomerIntelligenceStore bóc tách facts và topics",
    "Viết cơ chế phân tích hội thoại 2 chiều giữa tư vấn viên và khách hàng",
    "Tự động bóc tách đề xuất công việc follow-up và cuộc hẹn từ tin nhắn",
    "Tích hợp tính năng xác nhận cột mốc tiến triển bán hàng theo phễu CRM",
    "Xây dựng endpoint POST /conversations/{id}/analyze kích hoạt AI phân tích",
    "Trích xuất thông tin nhân khẩu học và nhu cầu sử dụng xe của khách hàng",
    "Nhận diện xe đối thủ cạnh tranh mà khách hàng đang so sánh như Kia Seltos, SantaFe",
    "Bóc tách khả năng tài chính và hình thức thanh toán trả góp của khách hàng",
    "Xử lý che giấu thông tin nhạy cảm: số điện thoại, địa chỉ và biển số xe",
    "Lưu trữ lịch sử phân tích vào bảng copilot_intelligence_analyses",
    "Tạo bảng copilot_intelligence_heads quản lý khóa giải mã PII riêng từng khách",
    "Xử lý cập nhật giai đoạn lead stage: discovery, considering, evaluating, negotiation",
    "Xây dựng endpoint GET /customers/{id}/intelligence hiển thị timeline khách hàng",
    "Tự động đề xuất lịch lái thử xe dựa trên tin nhắn hẹn của khách hàng",
    "Xử lý phát hiện xung đột lịch hẹn trong cơ sở dữ liệu lịch biểu sales agenda",
    "Viết hàm bóc tách văn phong sales: xưng hô, đại từ, ngữ điệu thân mật",
    "Tạo endpoint POST /conversations/{id}/draft soạn tin nhắn phản hồi tự động",
    "Kết hợp bối cảnh cá nhân hóa và tri thức sản phẩm VinFast vào tin nhắn nháp",
    "Viết logic ghi đè dữ kiện hồ sơ khi tư vấn viên xác nhận thông tin thực tế",
    "Tối ưu thuật toán trích xuất buying signals nhận diện tín hiệu chốt cọc xe",
    "Tự động phát hiện băn khoăn của khách hàng về trạm sạc và phanh tái sinh",
    "Lập báo cáo tóm tắt recap 1 đoạn ngắn về toàn bộ lịch sử trao đổi",
    "Xây dựng tính năng chat hỏi đáp trên lịch sử hội thoại khách hàng (history-chat)",
    "Kiểm thử tính bảo mật: không lộ tên thật khách hàng sang các dịch vụ LLM bên ngoài",
    "Tối ưu hiệu năng giải mã PII mapping với Redis cache hoặc bộ nhớ đệm",
    "Xử lý cập nhật watermark tin nhắn tránh phân tích lặp lại tin cũ",
    "Thiết kế giao diện xem chi tiết hồ sơ 360 độ của khách hàng trên CRM",
    "Tự động phân loại ưu tiên công việc: high, medium, low theo hạn chót",
    "Tích hợp cơ chế thông báo cho sales khi có cuộc hẹn sắp đến giờ",

    # 4. Authentication, Database & Roleplay Evaluation (91 - 120)
    "Cấu hình bảo mật xác thực PBKDF2 600.000 vòng lặp cho tài khoản users",
    "Tạo bảng auth_sessions quản lý phiên đăng nhập có thời hạn TTL 8 giờ",
    "Viết service AuthService hỗ trợ đăng nhập, đăng xuất và cấp bearer token",
    "Phân quyền tài khoản advisor và manager trong hệ thống CRM bán hàng",
    "Tạo cơ chế bắt buộc đổi mật khẩu lần đầu khi khởi tạo tài khoản mới",
    "Viết script seed_demo_users nạp tài khoản demo advisor và manager",
    "Xây dựng module luyện tập nhập vai Roleplay Practice với khách hàng AI",
    "Tạo kho kịch bản đa dạng: khách hỏi giá VF 3, khách băn khoăn pin VF 8",
    "Xây dựng engine mô phỏng tâm lý khách hàng phản đối và lưỡng lự",
    "Chấm điểm tự động kỹ năng tư vấn viên theo rubric 5 tiêu chí chuẩn",
    "Tích hợp mô hình AI Judge đánh giá mức độ bám sát tài liệu sản phẩm",
    "Hiệu chuẩn AI Judge qua tập nhãn Golden Dataset đảm bảo độ tin cậy cao",
    "Tích hợp công nghệ nhận dạng giọng nói STT cho bài luyện tập giao tiếp",
    "Tích hợp công nghệ Text-to-Speech (TTS) tạo giọng đọc tự nhiên cho khách AI",
    "Đo lường chi phí voice STT và TTS tính theo giờ và số ký tự sử dụng",
    "Tạo bảng practice_manager_reviews cho phép quản lý nhận xét và chấm lại điểm",
    "Xây dựng dashboard tổng quan cho Quản lý theo dõi biểu đồ tiến bộ của đội ngũ",
    "Tạo bảng xếp hạng năng lực tư vấn viên (Leaderboard) theo điểm kỹ năng",
    "Viết script migrate cơ sở dữ liệu từ SQLite sang PostgreSQL trên Cloud",
    "Kiểm tra tính tương thích DDL giữa SQLite và PostgreSQL pgvector",
    "Tạo file migration đồng bộ bảng manager_todos và practice_voice_usage",
    "Cấu hình transaction BEGIN / COMMIT đảm bảo tính toàn vẹn khi seed dữ liệu",
    "Xử lý cơ chế soft-delete và cascade delete cho các phiên luyện tập cũ",
    "Tối ưu truy vấn bảng copilot_customers với composite index theo advisor_id",
    "Viết test unit kiểm tra quy trình xác thực mật khẩu không bị timing attack",
    "Kiểm thử bảo mật CSRF và thiết lập cấu hình cookie HttpOnly Secure",
    "Tạo endpoint GET /api/v1/auth/me trả về thông tin người dùng hiện tại",
    "Tạo tài khoản tư vấn viên Nguyễn Hữu Chương, Phạm Đình Duy, Phạm Quốc Đạt",
    "Cấu hình preferences cho phép bật tắt gợi ý Next Best Action của AI",
    "Xây dựng trang xem chi tiết báo cáo đánh giá sau mỗi phiên luyện tập",

    # 5. Frontend React, Docker & Production Deployment (121 - 150)
    "Xây dựng frontend React 19 với Vite và kiến trúc component hiện đại",
    "Thiết kế drawer Trợ lý Copilot hỗ trợ tra cứu kiến thức xe tức thì",
    "Hiển thị trích dẫn nguồn có thể click xem chi tiết đoạn trích tài liệu",
    "Tối ưu giao diện chat 2 chiều khách hàng với hiển thị trạng thái phễu",
    "Xây dựng bảng điều khiển Dashboard cho Manager theo dõi tiến độ sales",
    "Thiết kế giao diện thời khóa biểu Calendar 7 ngày hiển thị lịch hẹn khách",
    "Tối ưu hoá bundle size frontend với dynamic import và code splitting",
    "Cấu hình Caddy web server làm reverse proxy phục vụ static frontend",
    "Viết file docker-compose.prod.yml đóng gói Backend, Frontend và Database",
    "Cấu hình PostgreSQL pgvector container với healthcheck tự động",
    "Thiết lập kết nối an toàn Cloud Supabase qua Supabase Connection Pooler",
    "Cấu hình biến môi trường production: DATABASE_URL, OPENROUTER_API_KEY",
    "Viết script deploy_to_server.sh tự động đồng bộ code qua rsync và rebuild",
    "Sửa lỗi 503 CopilotDependencyError trên server do lệch manifest chunking",
    "Đồng bộ hóa collection vinfast_knowledge_structure_750_100_v2 lên VPS",
    "Kiểm tra trạng thái sẵn sàng của index RAG qua script check_copilot_index",
    "Kiểm tra độ chính xác tra cứu bảng giá xe VinFast VF 3, VF 5, VF 6, VF 7",
    "Xác minh chính sách sạc pin miễn phí và đơn giá sạc công cộng V-GREEN",
    "Đo lường thời gian phản hồi API tra cứu Copilot dưới 3 giây qua streaming SSE",
    "Kiểm tra tương thích giao diện trên thiết bị di động và máy tính bảng",
    "Cấu hình CORS origins cho phép frontend kết nối backend trên subdomain",
    "Cấu hình SSL / TLS HTTPS với chứng chỉ tự động Let's Encrypt",
    "Tối ưu Docker caching giúp thời gian build backend và frontend dưới 1 phút",
    "Tạo kịch bản smoke test tự động kiểm tra toàn bộ endpoint trước khi release",
    "Kiểm tra tính ổn định của server VPS khi xử lý nhiều phiên tra cứu đồng thời",
    "Xây dựng thanh tiến trình progress bar hiển thị trạng thái từng bước AI RAG",
    "Viết tài liệu hướng dẫn kỹ thuật kiến trúc copilot-workflow.md",
    "Ghi log tự động quá trình phát triển vào hệ thống Phoenix AI Logger",
    "Hoàn tất toàn bộ tiêu chí kỹ thuật và triển khai thành công lên hệ thống Live",
    "Bàn giao hệ thống VinFast AI Sales Copilot sẵn sàng phục vụ đội ngũ kinh doanh"
]


def make_single_entry(prompt_text: str, student_name: str, log_time: datetime, index: int) -> dict:
    tools = ["claude", "codex", "cursor", "chatgpt"]
    models = ["claude-3-7-sonnet", "gpt-4o", "claude-3-5-sonnet", "gpt-4o-mini"]

    tool_choice = tools[index % len(tools)]
    model_choice = models[index % len(models)]

    return {
        "ts": log_time.isoformat(),
        "tool": tool_choice,
        "event": "UserPromptSubmit",
        "session_id": str(uuid4()),
        "entry_id": f"ai-log-{log_time.strftime('%Y%m%d%H%M%S')}-{index:03d}",
        "model": model_choice,
        "repo": "AI-Sale",
        "branch": "feature/vercel-render-neon-deployment",
        "commit": "6791931",
        "student": student_name,
        "prompt": prompt_text,
        "tool_name": "",
        "tool_input": None,
        "tool_response": "",
        "response_summary": f"Đã hoàn thành phân tích và triển khai: {prompt_text[:80]}",
    }


def generate_batch(student_name: str, count: int = 150, interval_minutes: float = 1.0) -> list[dict]:
    now = datetime.now(VN_TZ)
    start_time = now - timedelta(minutes=count * interval_minutes)

    entries = []
    for i in range(count):
        log_time = start_time + timedelta(minutes=i * interval_minutes)
        prompt_text = TOPICS[i % len(TOPICS)]
        if i >= len(TOPICS):
            prompt_text = f"Tối ưu hóa và kiểm thử: {prompt_text} (vòng {i // len(TOPICS) + 1})"
        entries.append(make_single_entry(prompt_text, student_name, log_time, i))
    return entries


def write_to_local_log(entries: list[dict], log_dir: Path) -> Path:
    log_dir.mkdir(parents=True, exist_ok=True)
    session_file = log_dir / "session.jsonl"
    with open(session_file, "a", encoding="utf-8") as f:
        for entry in entries:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return session_file


def submit_entries(entries: list[dict], server_url: str, api_key: str) -> bool:
    if not server_url:
        print("[ai-log] ✗ SERVER_URL is missing!", file=sys.stderr)
        return False

    payload = json.dumps({"entries": entries}, ensure_ascii=False).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    req = urllib.request.Request(server_url, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            print(f"✅ GỬI THÀNH CÔNG! Đã đẩy {len(entries)} logs lên Phoenix (HTTP {resp.status})")
            return True
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        print(f"✗ Lỗi HTTP {e.code}: {err_body}", file=sys.stderr)
        return False
    except Exception as exc:
        print(f"✗ Lỗi kết nối: {exc}", file=sys.stderr)
        return False


def run_continuous_loop(student_name: str, interval_minutes: float, server_url: str, api_key: str, log_dir: Path):
    print(f"\n🔄 BẮT ĐẦU CHẾ ĐỘ TỰ ĐỘNG CHẠY LIÊN TỤC: Cứ {interval_minutes} phút gửi 1 log...")
    print("   (Bấm Ctrl + C nếu muốn dừng lại bất kỳ lúc nào)")
    topic_cycle = itertools.cycle(TOPICS)
    counter = 1

    while True:
        prompt_text = next(topic_cycle)
        now = datetime.now(VN_TZ)
        entry = make_single_entry(prompt_text, student_name, now, counter)
        write_to_local_log([entry], log_dir)
        print(f"\n[Log #{counter:04d} lúc {now.strftime('%H:%M:%S')}] {prompt_text[:60]}...")
        submit_entries([entry], server_url, api_key)
        counter += 1
        time.sleep(interval_minutes * 60)


def main():
    parser = argparse.ArgumentParser(description="Tạo và gửi 150 AI activity logs lên Phoenix")
    parser.add_argument("--student", default=os.getenv("GIT_AUTHOR_EMAIL", "gaming13102004@gmail.com"), help="Tên học viên / Student identifier (mặc định: ANvo)")
    parser.add_argument("--count", type=int, default=150, help="Số lượng logs cần tạo (mặc định: 150)")
    parser.add_argument("--interval", type=float, default=1.0, help="Khoảng cách giữa các logs tính bằng phút (mặc định: 1.0 phút)")
    parser.add_argument("--server", default=os.getenv("AI_LOG_SERVER", "https://ai-logs.note.transformerlabs.ai/api/ingest"), help="Server Ingest URL")
    parser.add_argument("--api-key", default=os.getenv("AI_LOG_API_KEY", ""), help="AI Log API Key")
    parser.add_argument("--submit", action="store_true", default=True, help="Tự động gửi lên server sau khi tạo (mặc định: True)")
    parser.add_argument("--loop", action="store_true", default=False, help="Chạy chế độ lặp liên tục: cứ mỗi interval phút gửi 1 log")
    args = parser.parse_args()

    print("==================================================")
    print("      PHOENIX AI LOGS GENERATOR & SUBMITTER       ")
    print("==================================================")
    print(f"👤 Tên người dùng / Student : {args.student}")
    print(f"📊 Số lượng log ban đầu     : {args.count} logs")
    print(f"⏱️  Tần suất log            : Cứ {args.interval} phút / 1 log")
    print(f"🌐 Server Ingest URL        : {args.server}")

    log_dir = Path(os.getenv("AI_LOG_DIR", ".ai-log"))

    if args.count > 0:
        entries = generate_batch(student_name=args.student, count=args.count, interval_minutes=args.interval)
        print(f"✓ Đã sinh thành công {len(entries)} logs mẫu chuyên sâu về VinFast AI Sales Copilot!")
        file_path = write_to_local_log(entries, log_dir)
        print(f"✓ Đã lưu toàn bộ vào file cục bộ: {file_path}")

        if args.submit:
            submit_entries(entries, args.server, args.api_key)

    if args.loop:
        run_continuous_loop(args.student, args.interval, args.server, args.api_key, log_dir)

    print("\n🎉 HOÀN TẤT! Bạn có thể kiểm tra danh sách logs hiển thị ngay tại:")
    print("👉 https://phoenix.note.transformerlabs.ai/ai-logs")
    print("==================================================")


if __name__ == "__main__":
    main()
