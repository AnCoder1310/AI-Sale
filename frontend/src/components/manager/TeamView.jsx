import { useState, useMemo } from "react";
import {
  SearchIcon,
  RefreshIcon,
  ChevronRight,
  CloseIcon,
  ChatIcon,
} from "../common/Icons";
import { SHOWROOM_MEMBERS, getAdvisorAttempts } from "../../data/teamData";

function formatDate(value) {
  if (!value) return "Chưa có hoạt động";
  try {
    return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

export function TeamView({
  advisors = [],
  historyAttempts = [],
  loading = false,
  error = "",
  onAssign,
  onOpenReview,
  onRefresh,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAdvisor, setSelectedAdvisor] = useState(null);

  // Merge live backend advisors with showroom team profiles
  const mergedAdvisors = useMemo(() => {
    const list = [...SHOWROOM_MEMBERS];
    for (const backendAdv of advisors) {
      const existing = list.find((m) => m.advisor_id === backendAdv.advisor_id);
      if (existing) {
        existing.completed_sessions = Math.max(existing.completed_sessions, backendAdv.completed_sessions || 0);
        existing.approved_sessions = Math.max(existing.approved_sessions, backendAdv.approved_sessions || 0);
        if (backendAdv.average_score != null) {
          existing.score_3 = backendAdv.average_score;
          existing.score_100 = Math.round((backendAdv.average_score / 3) * 100);
        }
      } else {
        list.push({
          advisor_id: backendAdv.advisor_id,
          advisor_name: backendAdv.advisor_name || backendAdv.advisor_id,
          title: "Sales Consultant",
          avatar_url: null,
          initials: (backendAdv.advisor_name || backendAdv.advisor_id).substring(0, 2).toUpperCase(),
          status: backendAdv.status || "on_track",
          status_label: "Đạt chuẩn",
          score_100: backendAdv.average_score ? Math.round((backendAdv.average_score / 3) * 100) : 75,
          score_3: backendAdv.average_score || 2.3,
          completed_sessions: backendAdv.completed_sessions || 0,
          approved_sessions: backendAdv.approved_sessions || 0,
          latest_activity: backendAdv.latest_activity,
          competencies: [
            { id: "need_discovery", label: "Khám phá nhu cầu", score: 2.4, percentage: 80 },
            { id: "product_knowledge", label: "Kiến thức sản phẩm & Pin", score: 2.3, percentage: 77 },
            { id: "test_drive", label: "Kỹ năng trải nghiệm thực tế", score: 2.3, percentage: 77 },
            { id: "objection_handling", label: "Xử lý từ chối & đàm phán", score: 2.2, percentage: 73 },
            { id: "closing_deal", label: "Chốt deal & thủ tục ưu đãi", score: 2.2, percentage: 73 },
          ],
        });
      }
    }
    return list;
  }, [advisors]);

  const filtered = mergedAdvisors.filter((a) =>
    (a.advisor_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.advisor_id || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Attempts for selected advisor
  const selectedAdvisorAttempts = useMemo(() => {
    if (!selectedAdvisor) return [];
    return getAdvisorAttempts(selectedAdvisor.advisor_id, historyAttempts);
  }, [selectedAdvisor, historyAttempts]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1300, margin: "0 auto", paddingBottom: 40 }}>
      {/* Top Header matching Image 4 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#111111", letterSpacing: "-0.01em" }}>
            Quản Lý Đội Ngũ Tư Vấn Viên
          </h1>
          <p style={{ fontSize: "0.82rem", color: "#666666", marginTop: 4 }}>
            Tổng cộng {mergedAdvisors.length} nhân viên tại showroom VinFast Vinh, Nghệ An
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Search box matching Image 4 */}
          <div style={{ position: "relative", width: 280 }}>
            <SearchIcon style={{ position: "absolute", left: 12, top: 11, width: 14, height: 14, color: "#888888" }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên hoặc chức vụ…"
              style={{
                width: "100%",
                padding: "8px 12px 8px 34px",
                borderRadius: 10,
                border: "1px solid #D4D4D8",
                backgroundColor: "#FFFFFF",
                fontSize: "0.82rem",
                outline: "none",
              }}
            />
          </div>

          <button
            type="button"
            className="btn-outline"
            onClick={onRefresh}
            disabled={loading}
            style={{ padding: "8px 14px", fontSize: "0.82rem" }}
          >
            <RefreshIcon style={{ width: 13, height: 13 }} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="manager-error-alert" role="alert">
          <span>{error}</span>
          <button type="button" onClick={onRefresh}>Thử lại</button>
        </div>
      )}

      {/* Grid of Advisor Cards matching Image 4 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 20 }}>
        {filtered.map((adv) => {
          const isTop = adv.status === "top";
          const isAttention = adv.status === "needs_attention";

          return (
            <div
              key={adv.advisor_id}
              className="card-white card-white-hover"
              onClick={() => setSelectedAdvisor(adv)}
              style={{
                padding: "20px 22px",
                borderRadius: 16,
                border: "1px solid #E4E4E7",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 16,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <div>
                {/* Advisor Header Row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {adv.avatar_url ? (
                      <img
                        src={adv.avatar_url}
                        alt={adv.advisor_name}
                        style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover", border: "1px solid #E4E4E7" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: "50%",
                          backgroundColor: "#18181B",
                          color: "#FFFFFF",
                          fontWeight: 700,
                          fontSize: "0.95rem",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        {adv.initials}
                      </div>
                    )}
                    <div>
                      <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#111111", lineHeight: 1.2 }}>
                        {adv.advisor_name}
                      </h3>
                      <span style={{ fontSize: "0.76rem", color: "#71717A" }}>
                        {adv.title}
                      </span>
                    </div>
                  </div>

                  {/* Status Pill Badge matching Image 4 */}
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: 999,
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      backgroundColor: isTop ? "#18181B" : "#F4F4F5",
                      color: isTop ? "#FFFFFF" : isAttention ? "#52525B" : "#18181B",
                      border: "1px solid #E4E4E7",
                    }}
                  >
                    {isTop ? "Top" : isAttention ? "Attention" : "On track"}
                  </span>
                </div>

                {/* Score & Session Metrics */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    padding: "12px 14px",
                    backgroundColor: "#FAFAFA",
                    borderRadius: 12,
                    border: "1px solid #E4E4E7",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "0.7rem", color: "#71717A", display: "block" }}>Điểm TB:</span>
                    <strong style={{ fontSize: "1.1rem", color: "#111111" }}>
                      {adv.score_100 ? `${adv.score_100}/100` : `${adv.score_3}/3`}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.7rem", color: "#71717A", display: "block" }}>Hoàn thành:</span>
                    <strong style={{ fontSize: "1.1rem", color: "#111111" }}>
                      {adv.completed_sessions} phiên
                    </strong>
                  </div>
                </div>

                {/* Warning note if attention (matching Image 4) */}
                {adv.warning_tag && (
                  <div style={{ marginTop: 10, fontSize: "0.74rem", color: "#71717A", display: "flex", alignItems: "center", gap: 5 }}>
                    <span>⚠️</span>
                    <span>{adv.warning_tag}</span>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div style={{ paddingTop: 12, borderTop: "1px solid #F0F0EE", display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAssign(adv.advisor_id);
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 10,
                    backgroundColor: "#F4F4F5",
                    border: "1px solid #E4E4E7",
                    color: "#18181B",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  Giao kịch bản luyện tập
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAdvisor(adv);
                  }}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    backgroundColor: "#111111",
                    border: "1px solid #111111",
                    color: "#FFFFFF",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span>Xem hồ sơ</span>
                  <ChevronRight style={{ width: 12, height: 12 }} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ============================================================== */}
      {/* ADVISOR DETAIL DRAWER / MODAL (Addresses Image 4 Annotation!) */}
      {/* "bấm vào mới xem đc lịch sử chat, và thông số đánh giá của từng ng" */}
      {/* ============================================================== */}
      {selectedAdvisor && (
        <div className="review-modal-backdrop" onClick={() => setSelectedAdvisor(null)}>
          <div
            className="review-modal"
            style={{ maxWidth: 960 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="review-modal-header" style={{ backgroundColor: "#111111" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {selectedAdvisor.avatar_url ? (
                  <img
                    src={selectedAdvisor.avatar_url}
                    alt={selectedAdvisor.advisor_name}
                    style={{ width: 50, height: 50, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.2)" }}
                  />
                ) : (
                  <div style={{ width: 50, height: 50, borderRadius: "50%", backgroundColor: "#27272A", color: "#FFFFFF", display: "grid", placeItems: "center", fontWeight: 800, fontSize: "1.1rem" }}>
                    {selectedAdvisor.initials}
                  </div>
                )}
                <div>
                  <span style={{ color: "#D4D4D8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    HỒ SƠ NĂNG LỰC TƯ VẤN VIÊN
                  </span>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#FFFFFF", marginTop: 2 }}>
                    {selectedAdvisor.advisor_name}
                  </h2>
                  <p style={{ color: "#A1A1AA", fontSize: "0.78rem" }}>
                    {selectedAdvisor.title} • Showroom VinFast Vinh, Nghệ An • ID: {selectedAdvisor.advisor_id}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAdvisor(null)}
                style={{ background: "none", border: "none", color: "#FFFFFF", cursor: "pointer" }}
              >
                <CloseIcon style={{ width: 20, height: 20 }} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24, maxHeight: "calc(85vh - 80px)", overflowY: "auto" }}>
              {/* Overall Score & Stats Row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                <div style={{ padding: "16px 18px", borderRadius: 12, backgroundColor: "#F4F4F5", border: "1px solid #E4E4E7" }}>
                  <span style={{ fontSize: "0.72rem", color: "#71717A", display: "block" }}>Điểm Trung Bình</span>
                  <strong style={{ fontSize: "1.5rem", color: "#111111" }}>
                    {selectedAdvisor.score_100}/100
                  </strong>
                  <span style={{ fontSize: "0.72rem", color: "#52525B", display: "block", marginTop: 2 }}>
                    ({selectedAdvisor.score_3} / 3.0 Chuẩn VinFast)
                  </span>
                </div>

                <div style={{ padding: "16px 18px", borderRadius: 12, backgroundColor: "#F4F4F5", border: "1px solid #E4E4E7" }}>
                  <span style={{ fontSize: "0.72rem", color: "#71717A", display: "block" }}>Phiên Thực Chiến</span>
                  <strong style={{ fontSize: "1.5rem", color: "#111111" }}>
                    {selectedAdvisor.completed_sessions} bài
                  </strong>
                  <span style={{ fontSize: "0.72rem", color: "#52525B", display: "block", marginTop: 2 }}>
                    Đã duyệt: {selectedAdvisor.approved_sessions} phiên
                  </span>
                </div>

                <div style={{ padding: "16px 18px", borderRadius: 12, backgroundColor: "#F4F4F5", border: "1px solid #E4E4E7" }}>
                  <span style={{ fontSize: "0.72rem", color: "#71717A", display: "block" }}>Đánh Giá Xếp Loại</span>
                  <strong style={{ fontSize: "1.3rem", color: "#111111" }}>
                    {selectedAdvisor.status === "top" ? "Top Performer" : selectedAdvisor.status === "needs_attention" ? "Cần Đào Tạo Lại" : "Đạt Chuẩn Showroom"}
                  </strong>
                  <span style={{ fontSize: "0.72rem", color: "#52525B", display: "block", marginTop: 2 }}>
                    {selectedAdvisor.warning_tag || "Năng lực ổn định"}
                  </span>
                </div>
              </div>

              {/* 5 VinFast Sales Competencies Breakdown */}
              <div style={{ padding: 20, borderRadius: 14, border: "1px solid #E4E4E7", backgroundColor: "#FAFAFA" }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#111111", marginBottom: 14 }}>
                  Thông Số Đánh Giá Năng Lực (5 Tiêu Chí Bán Xe VinFast)
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {(selectedAdvisor.competencies || []).map((comp) => (
                    <div key={comp.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                        <span style={{ fontWeight: 600, color: "#111111" }}>{comp.label}</span>
                        <span style={{ fontWeight: 700, color: "#111111" }}>
                          {comp.score.toFixed(1)} / 3.0 ({comp.percentage}%)
                        </span>
                      </div>
                      <div style={{ width: "100%", height: 7, borderRadius: 999, backgroundColor: "#E4E4E7", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${comp.percentage}%`,
                            height: "100%",
                            backgroundColor: "#111111",
                            borderRadius: 999,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lịch Sử Roleplay & Chat Transcript của riêng User này */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#111111" }}>
                      Lịch Sử Thực Chiến Roleplay ({selectedAdvisorAttempts.length} phiên)
                    </h3>
                    <p style={{ fontSize: "0.75rem", color: "#71717A" }}>
                      Bấm vào từng phiên để xem chi tiết đoạn chat transcript tương tác và biên bản thẩm định điểm
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const advId = selectedAdvisor.advisor_id;
                      setSelectedAdvisor(null);
                      onAssign(advId);
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      backgroundColor: "#111111",
                      color: "#FFFFFF",
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    + Giao bài tập mới
                  </button>
                </div>

                {selectedAdvisorAttempts.length === 0 ? (
                  <div style={{ padding: "32px 20px", textAlign: "center", backgroundColor: "#FAFAFA", borderRadius: 12, border: "1px dashed #E4E4E7", color: "#71717A", fontSize: "0.82rem" }}>
                    Chưa có bài thi nào được ghi nhận cho nhân viên này.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {selectedAdvisorAttempts.map((att) => {
                      const isApproved = att.approved_score != null || att.status === "approved";
                      return (
                        <div
                          key={att.session_id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto auto",
                            alignItems: "center",
                            gap: 14,
                            padding: "14px 16px",
                            backgroundColor: "#FFFFFF",
                            borderRadius: 12,
                            border: "1px solid #E4E4E7",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <strong style={{ fontSize: "0.88rem", color: "#111111" }}>
                                {att.scenario_title || att.scenario_id}
                              </strong>
                              <span style={{ padding: "2px 8px", borderRadius: 6, backgroundColor: "#F4F4F5", fontSize: "0.7rem", fontWeight: 700, color: "#52525B" }}>
                                {att.model_badge || att.scenario_id}
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
                            onClick={() => {
                              setSelectedAdvisor(null);
                              onOpenReview(att.session_id);
                            }}
                            style={{
                              padding: "7px 14px",
                              borderRadius: 8,
                              backgroundColor: "#111111",
                              color: "#FFFFFF",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              border: "none",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <ChatIcon style={{ width: 13, height: 13 }} />
                            <span>Xem Lịch Sử Chat →</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
