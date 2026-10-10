import { useCallback, useEffect, useState } from "react";
import { managerApi } from "../../api/managerApi";
import { ManagerTopNav } from "../layout/ManagerTopNav";
import { ManagerReviewModal } from "./ManagerReviewModal";

function formatDate(value) {
  return value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
}

export function ManagerReviewView({ currentUser, onLogout }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [overview, setOverview] = useState(null);
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedReview, setSelectedReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [overviewData, queueData, historyData] = await Promise.all([
        managerApi.getTeamOverview(), managerApi.getReviewQueue(), managerApi.getManagerHistory({ limit: 50 }),
      ]);
      setOverview(overviewData);
      setQueue(queueData);
      setHistory(historyData);
    } catch (cause) {
      setError(cause.message || "Không thể tải dữ liệu quản lý.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      managerApi.getTeamOverview(), managerApi.getReviewQueue(), managerApi.getManagerHistory({ limit: 50 }),
    ]).then(([overviewData, queueData, historyData]) => {
      if (ignore) return;
      setOverview(overviewData);
      setQueue(queueData);
      setHistory(historyData);
    }).catch((cause) => {
      if (!ignore) setError(cause.message || "Không thể tải dữ liệu quản lý.");
    }).finally(() => {
      if (!ignore) setLoading(false);
    });
    return () => { ignore = true; };
  }, []);

  const openReview = async (sessionId) => {
    setError("");
    try {
      setSelectedReview(await managerApi.getReviewDetail(sessionId));
    } catch (cause) {
      setError(cause.message || "Không thể tải chi tiết phiên luyện tập.");
    }
  };

  const approve = async (decision) => {
    if (!selectedReview) return;
    try {
      await managerApi.approveReview(selectedReview.attempt.session_id, decision);
      setSelectedReview(null);
      await load();
    } catch (cause) {
      setError(cause.message || "Không thể duyệt đánh giá. Vui lòng thử lại.");
      throw cause;
    }
  };

  const attempts = activeTab === "reports" ? history : queue;

  return (
    <div className="manager-app-layout">
      <ManagerTopNav activeTab={activeTab} onTabChange={setActiveTab} currentUser={currentUser}
        pendingCount={queue.length} onLogout={onLogout} />
      <main className="manager-app-content">
        <h1>{activeTab === "reports" ? "Lịch sử luyện tập" : "Tổng quan đội ngũ"}</h1>
        {error && <div className="manager-error-alert" role="alert">{error} <button type="button" onClick={load}>Thử lại</button></div>}
        {activeTab === "dashboard" && overview && (
          <div className="console-stats-grid" aria-label="Số liệu từ phiên luyện tập">
            <div className="console-stat-box"><span className="cs-label">Tư vấn viên hoạt động</span><strong className="cs-val">{overview.active_advisors}</strong></div>
            <div className="console-stat-box"><span className="cs-label">Phiên hoàn thành</span><strong className="cs-val">{overview.completed_attempts}</strong></div>
            <div className="console-stat-box"><span className="cs-label">Đã duyệt</span><strong className="cs-val">{overview.approved_attempts}</strong></div>
            <div className="console-stat-box"><span className="cs-label">Chờ duyệt</span><strong className="cs-val">{overview.pending_attempts}</strong></div>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "24px 0" }}>
          <h2>{activeTab === "reports" ? "Các phiên đã ghi nhận" : "Hàng đợi duyệt"}</h2>
          <button type="button" className="btn-outline" onClick={load} disabled={loading}>Làm mới</button>
        </div>
        {loading ? <p role="status">Đang tải dữ liệu…</p> : attempts.length === 0 ?
          <p>Chưa có phiên luyện tập nào trong mục này.</p> :
          <div className="card-white" style={{ padding: 20 }}>
            {attempts.map((attempt) => (
              <div key={attempt.session_id} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "12px 0", borderBottom: "1px solid #e5e5e5" }}>
                <div><strong>{attempt.advisor_id}</strong> · {attempt.scenario_id}<br />
                  <small>{formatDate(attempt.completed_at)} · {attempt.review_status} · Điểm AI: {attempt.ai_score ?? "—"}</small></div>
                <button type="button" className="btn-outline" onClick={() => openReview(attempt.session_id)}>Xem đánh giá</button>
              </div>
            ))}
          </div>}
      </main>
      {selectedReview && <ManagerReviewModal detail={selectedReview} onClose={() => setSelectedReview(null)} onApprove={approve} />}
    </div>
  );
}
