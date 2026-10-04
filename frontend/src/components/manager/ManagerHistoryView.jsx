import { useState, useEffect, useCallback } from "react";
import { managerApi } from "../../api/managerApi";
import {
  FilterIcon,
  RefreshIcon,
  ChevronRight,
} from "../common/Icons";
import { Badge } from "../common/Badge";

const PAGE_SIZE = 15;

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function ManagerHistoryView({ onOpenReview }) {
  const [advisorId, setAdvisorId] = useState("");
  const [scenarioId, setScenarioId] = useState("");
  const [filters, setFilters] = useState({ advisorId: "", scenarioId: "" });
  const [page, setPage] = useState(0);
  const [attempts, setAttempts] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const items = await managerApi.getManagerHistory({
        advisorId: filters.advisorId.trim(),
        scenarioId: filters.scenarioId.trim(),
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setAttempts(Array.isArray(items) ? items : []);
      setStatus("ready");
    } catch (err) {
      setError(err.message || "Không thể tải lịch sử luyện tập.");
      setStatus("error");
    }
  }, [filters, page]);

  useEffect(() => {
    let ignore = false;
    managerApi.getManagerHistory({
      advisorId: filters.advisorId.trim(),
      scenarioId: filters.scenarioId.trim(),
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }).then((items) => {
      if (!ignore) {
        setAttempts(Array.isArray(items) ? items : []);
        setStatus("ready");
      }
    }).catch((err) => {
      if (!ignore) {
        setError(err.message || "Không thể tải lịch sử luyện tập.");
        setStatus("error");
      }
    });
    return () => {
      ignore = true;
    };
  }, [filters, page]);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    setPage(0);
    setFilters({ advisorId, scenarioId });
  };

  const handleResetFilters = () => {
    setAdvisorId("");
    setScenarioId("");
    setPage(0);
    setFilters({ advisorId: "", scenarioId: "" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1200, margin: "0 auto", paddingBottom: 40 }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#111111", letterSpacing: "-0.01em" }}>
            Lịch Sử Luyện Tập & Đàm Phán
          </h1>
          <p style={{ fontSize: "0.82rem", color: "#666666", marginTop: 4 }}>
            Tra cứu tất cả các attempt đã hoàn thành của đội ngũ tư vấn viên kèm điểm số và trạng thái duyệt
          </p>
        </div>

        <button
          type="button"
          className="btn-outline"
          onClick={load}
          disabled={status === "loading"}
          style={{ padding: "8px 14px", fontSize: "0.82rem" }}
        >
          <RefreshIcon style={{ width: 14, height: 14 }} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Filter Bar */}
      <form
        onSubmit={handleFilterSubmit}
        className="card-white"
        style={{ padding: "16px 20px", display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#444444", marginBottom: 4 }}>
            Mã / Tên tư vấn viên:
          </label>
          <input
            type="text"
            value={advisorId}
            onChange={(e) => setAdvisorId(e.target.value)}
            placeholder="VD: advisor-demo hoặc để trống"
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D4D4D8", fontSize: "0.82rem", outline: "none" }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#444444", marginBottom: 4 }}>
            Mã kịch bản:
          </label>
          <input
            type="text"
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            placeholder="VD: SCENARIO_01_VF5_TAXI"
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D4D4D8", fontSize: "0.82rem", outline: "none" }}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="submit"
            className="btn-primary"
            style={{ backgroundColor: "#111111", padding: "8px 16px", fontSize: "0.82rem" }}
          >
            <FilterIcon style={{ width: 13, height: 13 }} />
            <span>Lọc</span>
          </button>
          {(filters.advisorId || filters.scenarioId) && (
            <button
              type="button"
              className="btn-outline"
              onClick={handleResetFilters}
              style={{ padding: "8px 14px", fontSize: "0.82rem" }}
            >
              Xóa lọc
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="manager-error-alert" role="alert">
          <span>{error}</span>
          <button type="button" onClick={load}>Thử lại</button>
        </div>
      )}

      {/* History Table / List */}
      <div className="card-white" style={{ padding: 0, overflow: "hidden" }}>
        {status === "loading" ? (
          <div style={{ padding: "48px 20px", textAlign: "center", color: "#737373", fontSize: "0.9rem" }}>
            Đang tải lịch sử…
          </div>
        ) : attempts.length === 0 ? (
          <div style={{ padding: "56px 20px", textAlign: "center" }}>
            <div style={{ fontSize: "2.2rem", marginBottom: 10 }}>📜</div>
            <strong style={{ fontSize: "1rem", color: "#111111", display: "block" }}>
              Chưa có phiên luyện tập nào
            </strong>
            <p style={{ fontSize: "0.82rem", color: "#737373", marginTop: 4 }}>
              {filters.advisorId || filters.scenarioId
                ? "Không tìm thấy phiên luyện tập khớp với điều kiện lọc."
                : "Khi tư vấn viên thực hiện và hoàn thành các bài đàm phán, kết quả sẽ được lưu trữ và hiển thị tại đây."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {attempts.map((att, idx) => {
              const isApproved = att.review_status === "manager_approved";
              const isFailed = att.evaluation_status === "failed";
              const statusBadge = isApproved
                ? { label: "✓ Đã duyệt", variant: "default" }
                : isFailed
                ? { label: "Chấm điểm lỗi", variant: "default" }
                : { label: "⏳ Chờ duyệt", variant: "highlight" };

              return (
                <div
                  key={att.session_id}
                  style={{
                    padding: "16px 22px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    borderBottom: idx < attempts.length - 1 ? "1px solid #F0F0EE" : "none",
                    backgroundColor: idx % 2 === 0 ? "#FFFFFF" : "#FAFAFA",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        backgroundColor: "#1E293B",
                        color: "#FFFFFF",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      {att.advisor_id.substring(0, 2).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "0.92rem", color: "#111111" }}>{att.advisor_id}</strong>
                        <span style={{ fontSize: "0.78rem", color: "#737373" }}>• {att.scenario_id}</span>
                        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                      </div>
                      <div style={{ fontSize: "0.74rem", color: "#888888", marginTop: 3 }}>
                        Hoàn tất: {formatDate(att.completed_at)} • Session: {att.session_id}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 18, flexShrink: 0 }}>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "0.7rem", color: "#737373", display: "block" }}>
                        {isApproved ? "Điểm đã duyệt" : "AI Draft"}
                      </span>
                      <strong style={{ fontSize: "1rem", color: "#111111" }}>
                        {(att.approved_score ?? att.ai_score)?.toFixed(1) ?? "—"}
                        <small style={{ fontSize: "0.72rem", color: "#737373" }}>/3</small>
                      </strong>
                    </div>

                    <button
                      type="button"
                      className="btn-outline"
                      style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                      onClick={() => onOpenReview(att.session_id)}
                    >
                      <span>Xem chi tiết</span>
                      <ChevronRight style={{ width: 13, height: 13 }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        {status === "ready" && attempts.length > 0 && (
          <div style={{ padding: "14px 20px", borderTop: "1px solid #E5E5E5", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FAFAFA" }}>
            <span style={{ fontSize: "0.78rem", color: "#737373" }}>
              Hiển thị {attempts.length} phiên (Trang {page + 1})
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn-outline"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                style={{ padding: "4px 12px", fontSize: "0.78rem" }}
              >
                ← Trang trước
              </button>
              <button
                type="button"
                className="btn-outline"
                disabled={attempts.length < PAGE_SIZE}
                onClick={() => setPage((p) => p + 1)}
                style={{ padding: "4px 12px", fontSize: "0.78rem" }}
              >
                Trang sau →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
