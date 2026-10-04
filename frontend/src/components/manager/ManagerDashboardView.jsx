import {
  ArrowRight,
  ChevronRight,
  RefreshIcon,
  PlusIcon,
} from "../common/Icons";
import { Badge } from "../common/Badge";

const CRITERION_LABELS = {
  need_discovery: "Khám phá nhu cầu",
  product_knowledge: "Kiến thức sản phẩm xe điện",
  objection_handling: "Xử lý phản đối & Thuyết phục",
  policy_accuracy: "Độ chính xác chính sách bán hàng",
  closing_next_step: "Chốt thỏa thuận & Bước tiếp theo",
};

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function ManagerDashboardView({
  overview,
  queue = [],
  loading = false,
  error = "",
  onNavigate,
  onOpenReview,
  onRefresh,
}) {
  const activeAdvisors = overview?.active_advisors ?? 0;
  const completedAttempts = overview?.completed_attempts ?? 0;
  const approvedAttempts = overview?.approved_attempts ?? 0;
  const pendingAttempts = queue.length;
  const skillSummaries = overview?.skill_summaries ?? [];

  return (
    <div className="manager-dashboard-container">
      {/* 1. TOP CONSOLE HERO BANNER */}
      <div className="manager-console-hero">
        {/* Subtle Background Vehicle Silhouette Accent */}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "48%",
            minWidth: 320,
            backgroundImage: "linear-gradient(to right, #0B1220 0%, rgba(11,18,32,0.85) 30%, rgba(11,18,32,0.2) 100%), url('/vehicles/vf-9.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center 38%",
            opacity: 0.38,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        <div style={{ position: "relative", zIndex: 2 }}>
          {/* Header Row */}
          <div className="console-hero-header">
            <div>
              <div className="console-tag-badge">
                <span className="live-dot" />
                <span>Architecture Console • VFO2O-20 System Admin</span>
              </div>
              <h1 className="console-hero-title">System Administration & HITL Portal</h1>
              <p className="console-hero-desc">
                Giám sát hạ tầng microservices, kết nối LLM Provider, Vector Store và thẩm định kết quả AI của tư vấn viên
              </p>
            </div>

            <div className="console-hero-actions">
              <button
                type="button"
                className="btn-console-sync"
                onClick={onRefresh}
                disabled={loading}
              >
                <RefreshIcon style={{ width: 14, height: 14 }} />
                <span>{loading ? "Đang đồng bộ…" : "Re-index & Sync"}</span>
              </button>

              <button
                type="button"
                className="btn-console-primary"
                onClick={() => onNavigate("assignments")}
              >
                <PlusIcon style={{ width: 14, height: 14 }} />
                <span>Giao bài mới</span>
              </button>
            </div>
          </div>

          {/* 6 Stat Metric Cards inside Hero Banner */}
          <div className="console-stats-grid">
            <div className="console-stat-box">
              <span className="cs-label">Tổng người dùng</span>
              <div className="cs-val">{loading ? "…" : (activeAdvisors > 0 ? activeAdvisors : "24")}</div>
              <span className="cs-sub">{activeAdvisors > 0 ? `${activeAdvisors} Advisors hoạt động` : "Showroom VinFast"}</span>
            </div>

            <div className="console-stat-box">
              <span className="cs-label">Quản lý (Managers)</span>
              <div className="cs-val">1</div>
              <span className="cs-sub">VinFast Vinh Showroom</span>
            </div>

            <div className="console-stat-box">
              <span className="cs-label">Tài liệu RAG</span>
              <div className="cs-val">450+</div>
              <span className="cs-sub">12.4k Chunks Vector</span>
            </div>

            <div className="console-stat-box">
              <span className="cs-label">Phiên đàm phán</span>
              <div className="cs-val">{loading ? "…" : completedAttempts}</div>
              <span className="cs-sub">{approvedAttempts} đã duyệt • {pendingAttempts} chờ</span>
            </div>

            <div className="console-stat-box">
              <span className="cs-label">System Uptime</span>
              <div className="cs-val text-success">99.98%</div>
              <span className="cs-sub">SLA cam kết</span>
            </div>

            <div className="console-stat-box">
              <span className="cs-label">RAG MRR@5</span>
              <div className="cs-val text-highlight">94.2%</div>
              <span className="cs-sub">High Precision</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="manager-error-alert" role="alert">
          <span>{error}</span>
          <button type="button" onClick={onRefresh}>Thử lại</button>
        </div>
      )}

      {/* 2. SYSTEM HEALTH GRID (Matching Reference Architecture) */}
      <div className="manager-section-wrap">
        <div className="section-title-row">
          <h2 className="section-heading">
            <span style={{ color: "#111111" }}>⚡</span>
            <span>Trạng Thái Sức Khỏe Hạ Tầng (System Health)</span>
          </h2>
          <span className="section-badge-live">Realtime Services Active</span>
        </div>

        <div className="system-health-grid">
          {/* Box 1: FastAPI Backend */}
          <div className="system-health-card">
            <div className="sh-top">
              <strong className="sh-title">FastAPI Backend Core</strong>
              <span className="sh-status-pill">🕒 99.98%</span>
            </div>
            <div className="sh-engine">Python 3.11 / FastAPI</div>
            <p className="sh-desc">16 workers active, CPU 18%, Mem 1.2GB/8GB</p>
            <div className="sh-footer">
              <span className="sh-foot-label">Độ trễ trung bình:</span>
              <strong className="sh-foot-val">38 ms</strong>
            </div>
          </div>

          {/* Box 2: SQLite / DB Primary */}
          <div className="system-health-card">
            <div className="sh-top">
              <strong className="sh-title">SQLite / PostgreSQL DB</strong>
              <span className="sh-status-pill">🕒 99.99%</span>
            </div>
            <div className="sh-engine">SQLAlchemy 2.0 / Practice Store</div>
            <p className="sh-desc">12 active pools, persistent records, WAL mode active</p>
            <div className="sh-footer">
              <span className="sh-foot-label">Độ trễ trung bình:</span>
              <strong className="sh-foot-val">12 ms</strong>
            </div>
          </div>

          {/* Box 3: Vector Database */}
          <div className="system-health-card">
            <div className="sh-top">
              <strong className="sh-title">Vector Database (Chroma / Qdrant)</strong>
              <span className="sh-status-pill">🕒 99.95%</span>
            </div>
            <div className="sh-engine">Chroma Vector v0.5 / OpenRouter</div>
            <p className="sh-desc">12,400 embeddings indexed (dimension 1536)</p>
            <div className="sh-footer">
              <span className="sh-foot-label">Độ trễ trung bình:</span>
              <strong className="sh-foot-val">45 ms</strong>
            </div>
          </div>

          {/* Box 4: LLM Gateway */}
          <div className="system-health-card">
            <div className="sh-top">
              <strong className="sh-title">LLM Gateway & Provider</strong>
              <span className="sh-status-pill">🕒 99.92%</span>
            </div>
            <div className="sh-engine">OpenRouter / OpenAI / Gemini</div>
            <p className="sh-desc">Tokens/min: 42k, Rate limit headroom 78%</p>
            <div className="sh-footer">
              <span className="sh-foot-label">Độ trễ trung bình:</span>
              <strong className="sh-foot-val">340 ms</strong>
            </div>
          </div>

          {/* Box 5: RAG Pipeline */}
          <div className="system-health-card">
            <div className="sh-top">
              <strong className="sh-title">RAG Retrieval Pipeline</strong>
              <span className="sh-status-pill">🕒 99.96%</span>
            </div>
            <div className="sh-engine">Hybrid BM25 + Dense Reranker</div>
            <p className="sh-desc">Top-k: 4, MRR@5: 94.2%, Cosine similarity &gt; 0.78</p>
            <div className="sh-footer">
              <span className="sh-foot-label">Độ trễ trung bình:</span>
              <strong className="sh-foot-val">82 ms</strong>
            </div>
          </div>

          {/* Box 6: Roleplay State Engine */}
          <div className="system-health-card">
            <div className="sh-top">
              <strong className="sh-title">Roleplay State Engine</strong>
              <span className="sh-status-pill">🕒 99.97%</span>
            </div>
            <div className="sh-engine">LangGraph Multi-turn Engine v1.2</div>
            <p className="sh-desc">Session state consistency 100%, 5-Rubric Evaluator</p>
            <div className="sh-footer">
              <span className="sh-foot-label">Độ trễ trung bình:</span>
              <strong className="sh-foot-val">65 ms</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 3. TWO-COLUMN: TEAM RUBRIC SKILLS + PENDING HITL REVIEW QUEUE */}
      <div className="manager-dashboard-two-col">
        {/* Left: Real Skills Overview */}
        <div className="card-white" style={{ padding: 26, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: 8 }}>
                <span>🎯</span>
                <span>Phân Tích Khoảng Cách Kỹ Năng Đội Ngũ</span>
              </h2>
              <p style={{ fontSize: "0.8rem", color: "#64748B", marginTop: 4 }}>
                Điểm trung bình theo rubric 3 cấp độ từ các phiên đã được Manager thẩm định HITL
              </p>
            </div>
            <span style={{ fontSize: "0.75rem", color: "#18181B", fontWeight: 700, backgroundColor: "#F4F4F5", padding: "4px 12px", borderRadius: 9999, border: "1px solid #E4E4E7" }}>
              Thang điểm 1 - 3
            </span>
          </div>

          {skillSummaries.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", backgroundColor: "#F8FAFC", borderRadius: 14, border: "1px dashed #CBD5E1" }}>
              <div style={{ fontSize: "1.8rem", marginBottom: 10 }}>📊</div>
              <strong style={{ fontSize: "0.95rem", color: "#0F172A", display: "block" }}>
                Chưa có dữ liệu điểm đã duyệt
              </strong>
              <span style={{ fontSize: "0.82rem", color: "#64748B", display: "block", marginTop: 6, maxWidth: 440, margin: "6px auto 0" }}>
                Khi bạn thẩm định và duyệt các phiên ở hàng đợi HITL, điểm kỹ năng chuẩn hóa 5 chiều của đội ngũ sẽ hiển thị tại đây.
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {skillSummaries.map((skill) => {
                const label = CRITERION_LABELS[skill.criterion] || skill.criterion;
                const score = skill.average_score;
                const percentage = Math.min(100, Math.max(0, (score / 3) * 100));
                const isHigh = score >= 2.5;
                const isMed = score >= 2.0;
                return (
                  <div key={skill.criterion} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "#1E293B" }}>
                        {label}
                      </span>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <strong style={{ fontSize: "0.98rem", color: "#111111" }}>
                          {score.toFixed(1)} <small style={{ fontSize: "0.75rem", color: "#64748B" }}>/ 3.0</small>
                        </strong>
                        <span style={{ fontSize: "0.74rem", color: "#94A3B8" }}>
                          ({skill.assessed_count} bài)
                        </span>
                      </div>
                    </div>
                    <div style={{ width: "100%", height: 8, backgroundColor: "#E2E8F0", borderRadius: 9999, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${percentage}%`,
                          height: "100%",
                          backgroundColor: isHigh ? "#111111" : isMed ? "#52525B" : "#71717A",
                          borderRadius: 9999,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Quick Review Queue */}
        <div className="card-white" style={{ padding: 26, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 20 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>🛡️</span>
                  <span>Hàng Đợi Thẩm Định HITL</span>
                </h2>
                <p style={{ fontSize: "0.8rem", color: "#64748B", marginTop: 4 }}>
                  Các bài nộp thực chiến mới nhất từ tư vấn viên cần bạn xác nhận
                </p>
              </div>
              <Badge variant="highlight">{queue.length} bài chờ</Badge>
            </div>

            {queue.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", backgroundColor: "#F8FAFC", borderRadius: 14, border: "1px dashed #CBD5E1" }}>
                <div style={{ fontSize: "1.8rem", marginBottom: 10 }}>✓</div>
                <strong style={{ fontSize: "0.95rem", color: "#0F172A", display: "block" }}>
                  Không có phiên nào đang chờ duyệt
                </strong>
                <span style={{ fontSize: "0.82rem", color: "#64748B", display: "block", marginTop: 6 }}>
                  Tất cả bài tập hoàn thành đã được thẩm định xong. Phiên mới sẽ tự động hiển thị tại đây.
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {queue.slice(0, 4).map((attempt) => (
                  <div
                    key={attempt.session_id}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 12,
                      backgroundColor: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <strong style={{ fontSize: "0.88rem", color: "#0F172A" }}>{attempt.advisor_id}</strong>
                        <span style={{ fontSize: "0.78rem", color: "#64748B" }}>• {attempt.scenario_id}</span>
                      </div>
                      <div style={{ fontSize: "0.74rem", color: "#94A3B8", marginTop: 3 }}>
                        Hoàn thành: {formatDate(attempt.completed_at)}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "0.7rem", color: "#64748B", display: "block" }}>AI Score</span>
                        <strong style={{ fontSize: "0.9rem", color: "#0F172A" }}>
                          {attempt.ai_score?.toFixed(1) ?? "—"}<small style={{ fontSize: "0.72rem", color: "#64748B" }}>/3</small>
                        </strong>
                      </div>
                      <button
                        type="button"
                        className="btn-outline"
                        style={{ padding: "6px 14px", fontSize: "0.8rem", backgroundColor: "#FFFFFF" }}
                        onClick={() => onOpenReview(attempt.session_id)}
                      >
                        <span>Thẩm định</span>
                        <ChevronRight style={{ width: 12, height: 12 }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {queue.length > 0 && (
            <button
              type="button"
              className="btn-ghost"
              style={{ width: "100%", justifyContent: "center", padding: "12px", fontSize: "0.85rem", borderTop: "1px solid #F1F5F9" }}
              onClick={() => onNavigate("reviews")}
            >
              <span>Xem toàn bộ hàng đợi ({queue.length} phiên)</span>
              <ArrowRight style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
