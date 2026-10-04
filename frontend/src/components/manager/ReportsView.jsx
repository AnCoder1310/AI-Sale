import { useState, useMemo } from "react";
import {
  RefreshIcon,
  ChevronRight,
  ChevronDown,
} from "../common/Icons";
import { getVehicleImage } from "../../data/vehicleData";
import { SHOWROOM_MEMBERS, MOCK_TEAM_ATTEMPTS } from "../../data/teamData";

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

export function ReportsView({
  queue = [],
  historyAttempts = [],
  overview = null,
  loading = false,
  error = "",
  onOpenReview,
  onRefresh,
}) {
  const [subTab, setSubTab] = useState("queue"); // "queue" | "history" | "overview"
  const [viewMode, setViewMode] = useState("grouped"); // "grouped" | "flat"
  const [expandedUsers, setExpandedUsers] = useState({});

  // Merge live queue and mock pending attempts
  const allPendingAttempts = useMemo(() => {
    const list = [...queue];
    const seen = new Set(list.map((q) => q.session_id));
    for (const m of MOCK_TEAM_ATTEMPTS) {
      if (m.status === "pending" && !seen.has(m.session_id)) {
        list.push(m);
      }
    }
    return list;
  }, [queue]);

  // Merge live history and mock completed attempts
  const allCompletedAttempts = useMemo(() => {
    const list = [...historyAttempts];
    const seen = new Set(list.map((h) => h.session_id));
    for (const m of MOCK_TEAM_ATTEMPTS) {
      if (m.status === "approved" && !seen.has(m.session_id)) {
        list.push(m);
      }
    }
    return list;
  }, [historyAttempts]);

  // Group pending attempts by advisor
  const groupedQueue = useMemo(() => {
    const map = new Map();
    for (const att of allPendingAttempts) {
      const advId = att.advisor_id;
      if (!map.has(advId)) {
        const member = SHOWROOM_MEMBERS.find((m) => m.advisor_id === advId);
        map.set(advId, {
          advisor_id: advId,
          advisor_name: member?.advisor_name || att.advisor_name || advId,
          title: member?.title || "Tư vấn viên",
          initials: member?.initials || advId.substring(0, 2).toUpperCase(),
          attempts: [],
        });
      }
      map.get(advId).attempts.push(att);
    }
    return Array.from(map.values());
  }, [allPendingAttempts]);

  // Group history attempts by advisor
  const groupedHistory = useMemo(() => {
    const map = new Map();
    for (const att of allCompletedAttempts) {
      const advId = att.advisor_id;
      if (!map.has(advId)) {
        const member = SHOWROOM_MEMBERS.find((m) => m.advisor_id === advId);
        map.set(advId, {
          advisor_id: advId,
          advisor_name: member?.advisor_name || att.advisor_name || advId,
          title: member?.title || "Tư vấn viên",
          initials: member?.initials || advId.substring(0, 2).toUpperCase(),
          status: member?.status || "on_track",
          score_100: member?.score_100 || 80,
          attempts: [],
        });
      }
      map.get(advId).attempts.push(att);
    }
    return Array.from(map.values());
  }, [allCompletedAttempts]);

  const toggleUserExpand = (userId) => {
    setExpandedUsers((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  // Vehicle models for visual cards in Sub-tab 3
  const vehicleStats = [
    { model: "VF 3", name: "VinFast VF 3", attempts: 18, avgScore: "2.7/3", image: getVehicleImage("vf3") },
    { model: "VF 5", name: "VinFast VF 5 Plus", attempts: 32, avgScore: "2.5/3", image: getVehicleImage("vf5") },
    { model: "VF 6", name: "VinFast VF 6 Plus", attempts: 14, avgScore: "2.6/3", image: getVehicleImage("vf6") },
    { model: "VF 7", name: "VinFast VF 7 Plus", attempts: 24, avgScore: "2.8/3", image: getVehicleImage("vf7") },
    { model: "VF 8", name: "VinFast VF 8 Plus", attempts: 28, avgScore: "2.7/3", image: getVehicleImage("vf8") },
    { model: "VF 9", name: "VinFast VF 9 Plus", attempts: 19, avgScore: "2.6/3", image: getVehicleImage("vf9") },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1240, margin: "0 auto", paddingBottom: 40 }}>
      {/* Hero Banner matching Image 1 */}
      <section className="manager-review-hero" style={{ background: "linear-gradient(125deg, #111318, #18191E)" }}>
        <div>
          <span className="manager-kicker" style={{ color: "#E4E4E7", backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
            ◇ Human-In-The-Loop
          </span>
          <h1 style={{ fontSize: "clamp(1.6rem, 2.5vw, 2.2rem)", fontWeight: 800, color: "#FFFFFF", marginTop: 10, marginBottom: 6 }}>
            Quản lý đào tạo
          </h1>
          <p style={{ color: "#A1A1AA", fontSize: "0.85rem" }}>
            Duyệt đánh giá, xem lịch sử luyện tập và theo dõi năng lực từ dữ liệu đã lưu.
          </p>
        </div>

        <div className="manager-review-count" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <strong style={{ color: "#FFFFFF", fontSize: "2.2rem" }}>{allPendingAttempts.length}</strong>
          <span style={{ color: "#A1A1AA", fontSize: "0.72rem" }}>phiên chờ duyệt</span>
        </div>
      </section>

      {/* 3 Sub-tabs matching Image 1, 2, 3 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setSubTab("queue")}
            style={{
              padding: "7px 18px",
              borderRadius: 999,
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease",
              border: subTab === "queue" ? "1px solid #111111" : "1px solid #E4E4E7",
              backgroundColor: subTab === "queue" ? "#111111" : "#FFFFFF",
              color: subTab === "queue" ? "#FFFFFF" : "#52525B",
            }}
          >
            Chờ duyệt ({allPendingAttempts.length})
          </button>

          <button
            type="button"
            onClick={() => setSubTab("history")}
            style={{
              padding: "7px 18px",
              borderRadius: 999,
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease",
              border: subTab === "history" ? "1px solid #111111" : "1px solid #E4E4E7",
              backgroundColor: subTab === "history" ? "#111111" : "#FFFFFF",
              color: subTab === "history" ? "#FFFFFF" : "#52525B",
            }}
          >
            Lịch sử attempt
          </button>

          <button
            type="button"
            onClick={() => setSubTab("overview")}
            style={{
              padding: "7px 18px",
              borderRadius: 999,
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease",
              border: subTab === "overview" ? "1px solid #111111" : "1px solid #E4E4E7",
              backgroundColor: subTab === "overview" ? "#111111" : "#FFFFFF",
              color: subTab === "overview" ? "#FFFFFF" : "#52525B",
            }}
          >
            Tổng quan đội ngũ
          </button>
        </div>

        {/* View Mode Switcher (Grouped by User vs Flat) */}
        {(subTab === "queue" || subTab === "history") && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "#F4F4F5", padding: "3px 6px", borderRadius: 10, border: "1px solid #E4E4E7" }}>
            <button
              type="button"
              onClick={() => setViewMode("grouped")}
              style={{
                padding: "4px 10px",
                borderRadius: 8,
                fontSize: "0.74rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                backgroundColor: viewMode === "grouped" ? "#FFFFFF" : "transparent",
                color: viewMode === "grouped" ? "#111111" : "#71717A",
                boxShadow: viewMode === "grouped" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              👥 Nhóm theo Tư vấn viên
            </button>
            <button
              type="button"
              onClick={() => setViewMode("flat")}
              style={{
                padding: "4px 10px",
                borderRadius: 8,
                fontSize: "0.74rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                backgroundColor: viewMode === "flat" ? "#FFFFFF" : "transparent",
                color: viewMode === "flat" ? "#111111" : "#71717A",
                boxShadow: viewMode === "flat" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              📑 Xem danh sách phẳng
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="manager-error-alert" role="alert">
          <span>{error}</span>
          <button type="button" onClick={onRefresh}>Thử lại</button>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 1: CHỜ DUYỆT (REVIEW QUEUE) */}
      {/* ============================================================== */}
      {subTab === "queue" && (
        <section className="manager-queue-card" style={{ padding: 24, borderRadius: 18, border: "1px solid #E4E4E7", backgroundColor: "#FFFFFF" }}>
          <div className="manager-queue-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #F0F0EE", paddingBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#111111" }}>Review queue</h2>
              <p style={{ color: "#71717A", fontSize: "0.78rem", marginTop: 2 }}>
                Kết quả mới nhất trước; mỗi attempt chỉ được duyệt một lần.
              </p>
            </div>
            <button
              type="button"
              className="btn-outline"
              onClick={onRefresh}
              disabled={loading}
              style={{ padding: "6px 12px", fontSize: "0.78rem" }}
            >
              <RefreshIcon style={{ width: 13, height: 13 }} />
              <span>Tải lại</span>
            </button>
          </div>

          {allPendingAttempts.length === 0 ? (
            <div style={{ padding: "56px 20px", textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>✓</div>
              <strong style={{ fontSize: "1rem", color: "#111111", display: "block" }}>
                Không có phiên nào đang chờ duyệt
              </strong>
              <p style={{ fontSize: "0.82rem", color: "#71717A", marginTop: 4 }}>
                Tất cả các bài thi roleplay đã hoàn thành đều đã được thẩm định xong.
              </p>
            </div>
          ) : viewMode === "grouped" ? (
            /* GROUPED BY USER (Addresses Image 1 Note!) */
            <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 16 }}>
              {groupedQueue.map((group) => {
                const isExpanded = expandedUsers[group.advisor_id] !== false; // expanded by default
                return (
                  <div
                    key={group.advisor_id}
                    style={{
                      border: "1px solid #E4E4E7",
                      borderRadius: 14,
                      backgroundColor: "#FAFAFA",
                      overflow: "hidden",
                    }}
                  >
                    {/* User Group Header */}
                    <div
                      onClick={() => toggleUserExpand(group.advisor_id)}
                      style={{
                        padding: "14px 18px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                        backgroundColor: "#FFFFFF",
                        borderBottom: isExpanded ? "1px solid #E4E4E7" : "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: "50%", backgroundColor: "#18181B", color: "#FFFFFF", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "0.85rem" }}>
                          {group.initials}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <strong style={{ fontSize: "0.95rem", color: "#111111" }}>{group.advisor_name}</strong>
                            <span style={{ fontSize: "0.72rem", color: "#71717A" }}>({group.title})</span>
                          </div>
                          <span style={{ fontSize: "0.74rem", color: "#71717A" }}>
                            ID: {group.advisor_id}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <span style={{ padding: "4px 10px", borderRadius: 999, backgroundColor: "#F4F4F5", border: "1px solid #E4E4E7", fontSize: "0.75rem", fontWeight: 700, color: "#18181B" }}>
                          {group.attempts.length} phiên chờ duyệt
                        </span>
                        {isExpanded ? (
                          <ChevronDown style={{ width: 16, height: 16, color: "#71717A" }} />
                        ) : (
                          <ChevronRight style={{ width: 16, height: 16, color: "#71717A" }} />
                        )}
                      </div>
                    </div>

                    {/* Attempts of this user */}
                    {isExpanded && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14 }}>
                        {group.attempts.map((att) => (
                          <div
                            key={att.session_id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto auto",
                              alignItems: "center",
                              gap: 16,
                              padding: "14px 16px",
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #E4E4E7",
                              borderRadius: 12,
                            }}
                          >
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <strong style={{ fontSize: "0.88rem", color: "#111111" }}>
                                  {att.scenario_title || att.scenario_id}
                                </strong>
                                <span style={{ padding: "2px 8px", borderRadius: 6, backgroundColor: "#F4F4F5", fontSize: "0.7rem", fontWeight: 700, color: "#52525B" }}>
                                  {att.scenario_id}
                                </span>
                              </div>
                              <div style={{ fontSize: "0.74rem", color: "#71717A", marginTop: 4 }}>
                                Hoàn thành: {formatDate(att.completed_at)} • Session: {att.session_id}
                              </div>
                            </div>

                            <div style={{ textAlign: "center", padding: "0 10px" }}>
                              <span style={{ fontSize: "0.68rem", color: "#71717A", display: "block" }}>AI draft</span>
                              <strong style={{ fontSize: "1.1rem", color: "#111111" }}>
                                {att.ai_score?.toFixed(1) || "—"}<small style={{ fontSize: "0.72rem", color: "#71717A" }}>/3</small>
                              </strong>
                            </div>

                            <button
                              type="button"
                              onClick={() => onOpenReview(att.session_id)}
                              style={{
                                padding: "8px 16px",
                                borderRadius: 10,
                                backgroundColor: "#111111",
                                color: "#FFFFFF",
                                fontSize: "0.78rem",
                                fontWeight: 700,
                                border: "none",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Thẩm định điểm →
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* FLAT LIST */
            <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 16 }}>
              {allPendingAttempts.map((att) => (
                <div
                  key={att.session_id}
                  className="manager-review-row"
                  style={{ border: "1px solid #E4E4E7", backgroundColor: "#FAFAFA" }}
                >
                  <div className="manager-review-avatar" style={{ backgroundColor: "#18181B", color: "#FFFFFF" }}>
                    {(att.advisor_name || att.advisor_id).substring(0, 2).toUpperCase()}
                  </div>
                  <div className="manager-review-info">
                    <div>
                      <strong>{att.advisor_name || att.advisor_id}</strong>
                      <span>{att.scenario_id}</span>
                    </div>
                    <p>{att.scenario_title || "Luyện tập tư vấn xe VinFast"}</p>
                    <small>Hoàn thành: {formatDate(att.completed_at)} • Session: {att.session_id}</small>
                  </div>
                  <div className="manager-ai-score">
                    <span>AI draft</span>
                    <strong>{att.ai_score?.toFixed(1) || "—"}<small>/3</small></strong>
                  </div>
                  <button type="button" onClick={() => onOpenReview(att.session_id)} style={{ backgroundColor: "#111111", color: "#FFFFFF" }}>
                    Thẩm định điểm →
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 2: LỊCH SỬ ATTEMPT (GROUPED BY USER - Image 2) */}
      {/* ============================================================== */}
      {subTab === "history" && (
        <section style={{ padding: 24, borderRadius: 18, border: "1px solid #E4E4E7", backgroundColor: "#FFFFFF" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #F0F0EE", paddingBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#111111" }}>Lịch sử luyện tập</h2>
              <p style={{ color: "#71717A", fontSize: "0.78rem", marginTop: 2 }}>
                Tất cả attempt hoàn thành, nhóm theo từng tư vấn viên.
              </p>
            </div>
            <button
              type="button"
              className="btn-outline"
              onClick={onRefresh}
              disabled={loading}
              style={{ padding: "6px 12px", fontSize: "0.78rem" }}
            >
              <RefreshIcon style={{ width: 13, height: 13 }} />
              <span>Tải lại</span>
            </button>
          </div>

          {viewMode === "grouped" ? (
            /* GROUPED BY USER (Addresses Image 2 Note directly!) */
            <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 16 }}>
              {groupedHistory.map((group) => {
                const isExpanded = expandedUsers[group.advisor_id] !== false; // expanded by default
                return (
                  <div
                    key={group.advisor_id}
                    style={{
                      border: "1px solid #E4E4E7",
                      borderRadius: 14,
                      backgroundColor: "#FAFAFA",
                      overflow: "hidden",
                    }}
                  >
                    {/* User Group Header */}
                    <div
                      onClick={() => toggleUserExpand(group.advisor_id)}
                      style={{
                        padding: "14px 18px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                        backgroundColor: "#FFFFFF",
                        borderBottom: isExpanded ? "1px solid #E4E4E7" : "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: "#18181B", color: "#FFFFFF", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "0.9rem" }}>
                          {group.initials}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <strong style={{ fontSize: "0.95rem", color: "#111111" }}>{group.advisor_name}</strong>
                            <span style={{ fontSize: "0.74rem", color: "#71717A" }}>• {group.title}</span>
                          </div>
                          <span style={{ fontSize: "0.74rem", color: "#71717A" }}>
                            Đã hoàn thành {group.attempts.length} phiên thực chiến
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <span style={{ padding: "4px 10px", borderRadius: 999, backgroundColor: "#F4F4F5", border: "1px solid #E4E4E7", fontSize: "0.75rem", fontWeight: 700, color: "#111111" }}>
                          Điểm TB: {group.score_100}/100
                        </span>
                        {isExpanded ? (
                          <ChevronDown style={{ width: 16, height: 16, color: "#71717A" }} />
                        ) : (
                          <ChevronRight style={{ width: 16, height: 16, color: "#71717A" }} />
                        )}
                      </div>
                    </div>

                    {/* Attempts list of this user */}
                    {isExpanded && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14 }}>
                        {group.attempts.map((att) => {
                          const isApproved = att.approved_score != null || att.status === "approved";
                          return (
                            <div
                              key={att.session_id}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto auto",
                                alignItems: "center",
                                gap: 16,
                                padding: "14px 16px",
                                backgroundColor: "#FFFFFF",
                                border: "1px solid #E4E4E7",
                                borderRadius: 12,
                              }}
                            >
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <strong style={{ fontSize: "0.88rem", color: "#111111" }}>
                                    {att.scenario_title || att.scenario_id}
                                  </strong>
                                  <span style={{ padding: "2px 8px", borderRadius: 6, backgroundColor: "#F4F4F5", fontSize: "0.7rem", fontWeight: 700, color: "#52525B" }}>
                                    {att.scenario_id}
                                  </span>
                                </div>
                                <div style={{ fontSize: "0.74rem", color: "#71717A", marginTop: 4 }}>
                                  Hoàn thành: {formatDate(att.completed_at)} • Session: {att.session_id}
                                </div>
                              </div>

                              <div style={{ textAlign: "center", padding: "0 10px" }}>
                                <span style={{ fontSize: "0.68rem", color: "#71717A", display: "block" }}>
                                  {isApproved ? "Đã duyệt" : "AI draft"}
                                </span>
                                <strong style={{ fontSize: "1.05rem", color: "#111111" }}>
                                  {(att.approved_score ?? att.ai_score)?.toFixed(1) || "—"}
                                  <small style={{ fontSize: "0.72rem", color: "#71717A" }}>/3</small>
                                </strong>
                              </div>

                              <button
                                type="button"
                                className="btn-outline"
                                onClick={() => onOpenReview(att.session_id)}
                                style={{ padding: "7px 14px", fontSize: "0.78rem", backgroundColor: "#FFFFFF" }}
                              >
                                <span>Xem attempt →</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* FLAT LIST */
            <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 16 }}>
              {allCompletedAttempts.map((att) => {
                const isApproved = att.approved_score != null || att.status === "approved";
                return (
                  <div
                    key={att.session_id}
                    className="manager-review-row"
                    style={{ border: "1px solid #E4E4E7", backgroundColor: "#FAFAFA" }}
                  >
                    <div className="manager-review-avatar" style={{ backgroundColor: "#18181B", color: "#FFFFFF" }}>
                      {(att.advisor_name || att.advisor_id).substring(0, 2).toUpperCase()}
                    </div>
                    <div className="manager-review-info">
                      <div>
                        <strong>{att.advisor_name || att.advisor_id}</strong>
                        <span>{att.scenario_id}</span>
                      </div>
                      <p>{att.scenario_title || "Luyện tập tư vấn xe VinFast"}</p>
                      <small>Hoàn thành: {formatDate(att.completed_at)} • Session: {att.session_id}</small>
                    </div>
                    <div className="manager-ai-score">
                      <span>{isApproved ? "Đã duyệt" : "AI draft"}</span>
                      <strong>{(att.approved_score ?? att.ai_score)?.toFixed(1) || "—"}<small>/3</small></strong>
                    </div>
                    <button type="button" onClick={() => onOpenReview(att.session_id)} style={{ backgroundColor: "#111111", color: "#FFFFFF" }}>
                      Xem attempt →
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 3: TỔNG QUAN ĐỘI NGŨ & HÌNH ẢNH TRỰC QUAN (Image 3) */}
      {/* ============================================================== */}
      {subTab === "overview" && (
        <section style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* 4 Stat Boxes from Image 3 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            <div style={{ padding: "18px 20px", borderRadius: 14, backgroundColor: "#FFFFFF", border: "1px solid #E4E4E7" }}>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "#111111", lineHeight: 1 }}>
                {overview?.total_attempts ?? 28}
              </div>
              <span style={{ fontSize: "0.78rem", color: "#71717A", marginTop: 6, display: "block" }}>
                Attempt hoàn thành
              </span>
              <small style={{ fontSize: "0.68rem", color: "#A1A1AA" }}>
                1 attempt chấm điểm lỗi cần retry; không tính vào điểm kỹ năng.
              </small>
            </div>

            <div style={{ padding: "18px 20px", borderRadius: 14, backgroundColor: "#FFFFFF", border: "1px solid #E4E4E7" }}>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "#111111", lineHeight: 1 }}>
                {overview?.approved_attempts ?? 24}
              </div>
              <span style={{ fontSize: "0.78rem", color: "#71717A", marginTop: 6, display: "block" }}>
                Đã duyệt
              </span>
              <small style={{ fontSize: "0.68rem", color: "#A1A1AA" }}>
                Điểm chính thức của quản lý
              </small>
            </div>

            <div style={{ padding: "18px 20px", borderRadius: 14, backgroundColor: "#FFFFFF", border: "1px solid #E4E4E7" }}>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "#111111", lineHeight: 1 }}>
                1
              </div>
              <span style={{ fontSize: "0.78rem", color: "#71717A", marginTop: 6, display: "block" }}>
                Cần bổ sung
              </span>
              <small style={{ fontSize: "0.68rem", color: "#A1A1AA" }}>
                Tư vấn viên chưa đạt chuẩn
              </small>
            </div>

            <div style={{ padding: "18px 20px", borderRadius: 14, backgroundColor: "#FFFFFF", border: "1px solid #E4E4E7" }}>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "#111111", lineHeight: 1 }}>
                {SHOWROOM_MEMBERS.length}
              </div>
              <span style={{ fontSize: "0.78rem", color: "#71717A", marginTop: 6, display: "block" }}>
                Tư vấn viên đã luyện
              </span>
              <small style={{ fontSize: "0.68rem", color: "#A1A1AA" }}>
                Showroom VinFast Vinh, Nghệ An
              </small>
            </div>
          </div>

          {/* Visual Cards by Vehicle Model (Image 3 note: "cho mấy cái hình như em có nữa") */}
          <div style={{ padding: 24, borderRadius: 18, border: "1px solid #E4E4E7", backgroundColor: "#FFFFFF" }}>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#111111" }}>
                Thực Chiến Theo Dòng Xe VinFast
              </h3>
              <p style={{ color: "#71717A", fontSize: "0.78rem", marginTop: 2 }}>
                Mức độ hoàn thành các kịch bản đàm phán theo từng mẫu xe điện
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
              {vehicleStats.map((v) => (
                <div
                  key={v.model}
                  style={{
                    borderRadius: 14,
                    border: "1px solid #E4E4E7",
                    overflow: "hidden",
                    backgroundColor: "#FAFAFA",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div style={{ height: 110, position: "relative", backgroundColor: "#0F1117" }}>
                    <img src={v.image} alt={v.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{ position: "absolute", top: 8, left: 8, padding: "2px 8px", borderRadius: 999, backgroundColor: "rgba(0,0,0,0.75)", color: "#FFFFFF", fontSize: "0.7rem", fontWeight: 700 }}>
                      {v.model}
                    </div>
                  </div>
                  <div style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ fontSize: "0.85rem", color: "#111111", display: "block" }}>{v.name}</strong>
                      <span style={{ fontSize: "0.72rem", color: "#71717A" }}>{v.attempts} lượt hoàn thành</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "0.68rem", color: "#71717A", display: "block" }}>Điểm TB</span>
                      <strong style={{ fontSize: "0.88rem", color: "#111111" }}>{v.avgScore}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Table: Điểm kỹ năng đã duyệt from Image 3 */}
          <div style={{ padding: 24, borderRadius: 18, border: "1px solid #E4E4E7", backgroundColor: "#FFFFFF" }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#111111", marginBottom: 14 }}>
              Điểm Kỹ Năng Đã Duyệt
            </h3>

            <div style={{ border: "1px solid #E4E4E7", borderRadius: 12, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ backgroundColor: "#F4F4F5", borderBottom: "1px solid #E4E4E7", textAlign: "left", color: "#52525B" }}>
                    <th style={{ padding: "10px 16px" }}>Tiêu chí đánh giá</th>
                    <th style={{ padding: "10px 16px", textAlign: "center" }}>Điểm trung bình</th>
                    <th style={{ padding: "10px 16px", textAlign: "center" }}>Tỉ lệ đạt chuẩn</th>
                    <th style={{ padding: "10px 16px", textAlign: "right" }}>Số bài đã chấm</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #F0F0EE" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>Khám phá nhu cầu</td>
                    <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: 800 }}>3.0 / 3.0</td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 999, backgroundColor: "#F4F4F5", border: "1px solid #E4E4E7", fontWeight: 700 }}>100%</span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "#71717A" }}>1 bài đã chấm</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #F0F0EE" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>Kiến thức sản phẩm</td>
                    <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: 800 }}>2.0 / 3.0</td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 999, backgroundColor: "#F4F4F5", border: "1px solid #E4E4E7", fontWeight: 700 }}>67%</span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "#71717A" }}>1 bài đã chấm</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>Xử lý phản đối</td>
                    <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: 800 }}>3.0 / 3.0</td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 999, backgroundColor: "#F4F4F5", border: "1px solid #E4E4E7", fontWeight: 700 }}>100%</span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "#71717A" }}>1 bài đã chấm</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
