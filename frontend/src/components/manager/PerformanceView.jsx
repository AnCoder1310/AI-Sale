import { useState, useMemo } from "react";
import {
  TrophyIcon,
  RefreshIcon,
  CloseIcon,
  SearchIcon,
} from "../common/Icons";
import { getVehicleImage } from "../../data/vehicleData";
import { SCENARIO_PRESETS } from "../../data/scenarioData";
import { getScenarioLeaderboard } from "../../data/teamData";

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

export function PerformanceView({
  scenarios = [],
  historyAttempts = [],
  loading = false,
  error = "",
  onOpenReview,
  onRefresh,
}) {
  const [selectedModel, setSelectedModel] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeLeaderboardScenario, setActiveLeaderboardScenario] = useState(null);

  // Combine backend scenarios with preset details
  const displayScenarios = useMemo(() => {
    const list = scenarios.length > 0 ? scenarios : SCENARIO_PRESETS;
    return list.map((sc) => {
      const matchPreset = SCENARIO_PRESETS.find((p) => p.scenario_id === sc.scenario_id);
      const model = sc.model_badge || matchPreset?.model_badge || sc.title?.match(/VF\s*[3-9]|Wild/i)?.[0] || "VinFast EV";
      const modelKey = model.toLowerCase().replace(/[^a-z0-9]/g, "");
      const image = getVehicleImage(modelKey);
      const persona = sc.persona || matchPreset?.persona || { name: "Khách hàng quan tâm xe điện" };
      return {
        ...sc,
        model_badge: model,
        model_key: modelKey,
        image,
        persona,
        description: sc.description || matchPreset?.training_objective || "Tư vấn đàm phán chính sách & công nghệ xe điện",
      };
    });
  }, [scenarios]);

  // Model filter tabs
  const models = ["all", "VF 3", "VF 5", "VF 6", "VF 7", "VF 8", "VF 9", "VF Wild"];

  const filteredScenarios = displayScenarios.filter((sc) => {
    const matchModel = selectedModel === "all" || sc.model_badge.toLowerCase().includes(selectedModel.toLowerCase());
    const matchSearch =
      sc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sc.model_badge.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sc.persona?.name || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchModel && matchSearch;
  });

  // Calculate Leaderboard for active scenario
  const activeLeaderboard = useMemo(() => {
    if (!activeLeaderboardScenario) return [];
    return getScenarioLeaderboard(activeLeaderboardScenario.scenario_id, historyAttempts);
  }, [activeLeaderboardScenario, historyAttempts]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1300, margin: "0 auto", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, backgroundColor: "#F4F4F5", border: "1px solid #E4E4E7", fontSize: "0.72rem", fontWeight: 700, color: "#18181B", marginBottom: 6 }}>
            <TrophyIcon style={{ width: 13, height: 13 }} />
            <span>XẾP HẠNG & NĂNG LỰC THỰC CHIẾN</span>
          </div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#111111", letterSpacing: "-0.01em" }}>
            Kịch Bản Luyện Tập & Bảng Xếp Hạng (Ranking)
          </h1>
          <p style={{ fontSize: "0.82rem", color: "#666666", marginTop: 4 }}>
            Theo dõi mức độ thành thạo và xếp hạng tư vấn viên đạt điểm cao nhất theo từng tình huống xe VinFast
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Search box */}
          <div style={{ position: "relative", width: 260 }}>
            <SearchIcon style={{ position: "absolute", left: 12, top: 11, width: 14, height: 14, color: "#888888" }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo mẫu xe, kịch bản…"
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

      {/* Model Filter Pills */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {models.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setSelectedModel(m)}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
              border: selectedModel === m ? "1px solid #111111" : "1px solid #E4E4E7",
              backgroundColor: selectedModel === m ? "#111111" : "#FFFFFF",
              color: selectedModel === m ? "#FFFFFF" : "#52525B",
              whiteSpace: "nowrap",
            }}
          >
            {m === "all" ? "Tất cả dòng xe" : m}
          </button>
        ))}
      </div>

      {/* Scenarios Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 20 }}>
        {filteredScenarios.map((sc) => {
          const leaderboard = getScenarioLeaderboard(sc.scenario_id, historyAttempts);
          const top1 = leaderboard[0];
          const totalAttempts = leaderboard.reduce((acc, cur) => acc + cur.attempt_count, 0);
          const avgScore =
            leaderboard.length > 0
              ? (leaderboard.reduce((acc, cur) => acc + cur.best_score, 0) / leaderboard.length).toFixed(1)
              : null;

          return (
            <div
              key={sc.scenario_id}
              className="card-white card-white-hover"
              style={{
                padding: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                borderRadius: 16,
                border: "1px solid #E4E4E7",
              }}
            >
              {/* Vehicle Thumbnail & Badge */}
              <div style={{ position: "relative", height: 160, overflow: "hidden", backgroundColor: "#0F1117" }}>
                <img
                  src={sc.image}
                  alt={sc.model_badge}
                  style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.9 }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(to top, rgba(17,17,17,0.9) 0%, rgba(17,17,17,0.2) 60%, transparent 100%)",
                  }}
                />
                <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6 }}>
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: 999,
                      backgroundColor: "rgba(0, 0, 0, 0.75)",
                      color: "#FFFFFF",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    {sc.model_badge}
                  </span>
                </div>

                <div style={{ position: "absolute", bottom: 12, left: 14, right: 14 }}>
                  <div style={{ fontSize: "0.72rem", color: "#A1A1AA" }}>Khách hàng mục tiêu:</div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {sc.persona?.name || "Khách hàng"} • {sc.persona?.role || "Gia đình"}
                  </div>
                </div>
              </div>

              {/* Scenario Body */}
              <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#111111", lineHeight: 1.3, minHeight: 42 }}>
                    {sc.title}
                  </h3>
                  <p style={{ fontSize: "0.78rem", color: "#666666", marginTop: 4, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {sc.description}
                  </p>
                </div>

                {/* Metrics Box */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    padding: "10px 14px",
                    backgroundColor: "#F4F4F5",
                    borderRadius: 10,
                    border: "1px solid #E4E4E7",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "0.68rem", color: "#71717A", display: "block" }}>Lượt thực chiến</span>
                    <strong style={{ fontSize: "0.95rem", color: "#111111" }}>
                      {totalAttempts > 0 ? `${totalAttempts} lượt` : "Chưa có"}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.68rem", color: "#71717A", display: "block" }}>Điểm TB kịch bản</span>
                    <strong style={{ fontSize: "0.95rem", color: "#111111" }}>
                      {avgScore ? `${avgScore} / 3.0` : "—"}
                    </strong>
                  </div>
                </div>

                {/* Top Performer Badge */}
                {top1 ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: 8,
                      backgroundColor: "#FAFAFA",
                      border: "1px solid #E4E4E7",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "1rem" }}>🏆</span>
                      <div>
                        <div style={{ fontSize: "0.68rem", color: "#71717A" }}>Quán quân kịch bản:</div>
                        <strong style={{ fontSize: "0.82rem", color: "#111111" }}>{top1.advisor_name}</strong>
                      </div>
                    </div>
                    <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#111111" }}>
                      {top1.best_score.toFixed(1)} / 3.0
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: "0.74rem", color: "#71717A", textAlign: "center", padding: "6px" }}>
                    Chưa có bài thi nào được hoàn thành cho tình huống này
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div style={{ padding: "12px 20px 16px", borderTop: "1px solid #F0F0EE" }}>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setActiveLeaderboardScenario(sc)}
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    padding: "9px 14px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    backgroundColor: "#111111",
                    color: "#FFFFFF",
                    border: "1px solid #111111",
                    gap: 6,
                  }}
                >
                  <TrophyIcon style={{ width: 14, height: 14 }} />
                  <span>Xem Bảng Xếp Hạng (Ranking) 🏆</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Leaderboard Modal / Drawer */}
      {activeLeaderboardScenario && (
        <div className="review-modal-backdrop" onClick={() => setActiveLeaderboardScenario(null)}>
          <div
            className="review-modal"
            style={{ maxWidth: 880 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="review-modal-header" style={{ backgroundColor: "#111111" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#27272A", display: "grid", placeItems: "center" }}>
                  <TrophyIcon style={{ width: 22, height: 22, color: "#FFFFFF" }} />
                </div>
                <div>
                  <span style={{ color: "#D4D4D8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    BẢNG XẾP HẠNG THÀNH TÍCH (LEADERBOARD)
                  </span>
                  <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#FFFFFF", marginTop: 2 }}>
                    {activeLeaderboardScenario.title}
                  </h2>
                  <p style={{ color: "#A1A1AA", fontSize: "0.78rem" }}>
                    Mẫu xe: <strong>{activeLeaderboardScenario.model_badge}</strong> • Đối tượng: {activeLeaderboardScenario.persona?.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveLeaderboardScenario(null)}
                style={{ background: "none", border: "none", color: "#FFFFFF", cursor: "pointer" }}
              >
                <CloseIcon style={{ width: 20, height: 20 }} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Podium Top 3 */}
              {activeLeaderboard.length >= 2 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: 14, alignItems: "end" }}>
                  {/* Top 2 */}
                  {activeLeaderboard[1] && (
                    <div
                      style={{
                        padding: 16,
                        borderRadius: 14,
                        backgroundColor: "#F4F4F5",
                        border: "1px solid #E4E4E7",
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontSize: "1.5rem" }}>🥈</div>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "#52525B", color: "#FFFFFF", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "0.85rem" }}>
                        {activeLeaderboard[1].initials}
                      </div>
                      <strong style={{ fontSize: "0.88rem", color: "#111111" }}>{activeLeaderboard[1].advisor_name}</strong>
                      <span style={{ fontSize: "0.72rem", color: "#71717A" }}>{activeLeaderboard[1].title}</span>
                      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#111111", marginTop: 4 }}>
                        {activeLeaderboard[1].best_score.toFixed(1)} <small style={{ fontSize: "0.75rem", color: "#71717A" }}>/ 3.0</small>
                      </div>
                      <span style={{ fontSize: "0.72rem", color: "#52525B", backgroundColor: "#E4E4E7", padding: "2px 8px", borderRadius: 999 }}>
                        {activeLeaderboard[1].score_100}/100
                      </span>
                    </div>
                  )}

                  {/* Top 1 Quán Quân */}
                  {activeLeaderboard[0] && (
                    <div
                      style={{
                        padding: "20px 16px",
                        borderRadius: 16,
                        backgroundColor: "#18181B",
                        color: "#FFFFFF",
                        border: "1px solid #27272A",
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                        transform: "translateY(-8px)",
                      }}
                    >
                      <div style={{ fontSize: "1.8rem" }}>👑</div>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: "#FFFFFF", color: "#111111", display: "grid", placeItems: "center", fontWeight: 800, fontSize: "1rem" }}>
                        {activeLeaderboard[0].initials}
                      </div>
                      <strong style={{ fontSize: "0.98rem", color: "#FFFFFF" }}>{activeLeaderboard[0].advisor_name}</strong>
                      <span style={{ fontSize: "0.72rem", color: "#D4D4D8" }}>{activeLeaderboard[0].title}</span>
                      <div style={{ fontSize: "1.35rem", fontWeight: 900, color: "#FFFFFF", marginTop: 4 }}>
                        {activeLeaderboard[0].best_score.toFixed(1)} <small style={{ fontSize: "0.8rem", color: "#A1A1AA" }}>/ 3.0</small>
                      </div>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#111111", backgroundColor: "#FFFFFF", padding: "3px 10px", borderRadius: 999 }}>
                        QUÁN QUÂN • {activeLeaderboard[0].score_100}/100
                      </span>
                    </div>
                  )}

                  {/* Top 3 */}
                  {activeLeaderboard[2] && (
                    <div
                      style={{
                        padding: 16,
                        borderRadius: 14,
                        backgroundColor: "#F4F4F5",
                        border: "1px solid #E4E4E7",
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontSize: "1.5rem" }}>🥉</div>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "#71717A", color: "#FFFFFF", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "0.85rem" }}>
                        {activeLeaderboard[2].initials}
                      </div>
                      <strong style={{ fontSize: "0.88rem", color: "#111111" }}>{activeLeaderboard[2].advisor_name}</strong>
                      <span style={{ fontSize: "0.72rem", color: "#71717A" }}>{activeLeaderboard[2].title}</span>
                      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#111111", marginTop: 4 }}>
                        {activeLeaderboard[2].best_score.toFixed(1)} <small style={{ fontSize: "0.75rem", color: "#71717A" }}>/ 3.0</small>
                      </div>
                      <span style={{ fontSize: "0.72rem", color: "#52525B", backgroundColor: "#E4E4E7", padding: "2px 8px", borderRadius: 999 }}>
                        {activeLeaderboard[2].score_100}/100
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Full Leaderboard Table */}
              <div>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#111111", marginBottom: 12 }}>
                  Danh Sách Xếp Hạng Chi Tiết ({activeLeaderboard.length} tư vấn viên)
                </h3>

                {activeLeaderboard.length === 0 ? (
                  <div style={{ padding: "36px 20px", textAlign: "center", backgroundColor: "#FAFAFA", borderRadius: 12, border: "1px dashed #E4E4E7", color: "#71717A" }}>
                    Chưa có lượt thực chiến nào được ghi nhận cho kịch bản này.
                  </div>
                ) : (
                  <div style={{ border: "1px solid #E4E4E7", borderRadius: 12, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#F4F4F5", borderBottom: "1px solid #E4E4E7", textAlign: "left", color: "#52525B" }}>
                          <th style={{ padding: "10px 14px", width: 60, textAlign: "center" }}>Hạng</th>
                          <th style={{ padding: "10px 14px" }}>Tư vấn viên</th>
                          <th style={{ padding: "10px 14px", textAlign: "center" }}>Điểm cao nhất</th>
                          <th style={{ padding: "10px 14px", textAlign: "center" }}>Thang 100</th>
                          <th style={{ padding: "10px 14px", textAlign: "center" }}>Lượt chơi</th>
                          <th style={{ padding: "10px 14px" }}>Ngày đạt</th>
                          <th style={{ padding: "10px 14px", textAlign: "right" }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeLeaderboard.map((item, idx) => (
                          <tr
                            key={item.advisor_id}
                            style={{
                              borderBottom: idx < activeLeaderboard.length - 1 ? "1px solid #F0F0EE" : "none",
                              backgroundColor: idx === 0 ? "#FAFAFA" : "#FFFFFF",
                            }}
                          >
                            <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 800 }}>
                              {idx === 0 ? "🥇 1" : idx === 1 ? "🥈 2" : idx === 2 ? "🥉 3" : `#${idx + 1}`}
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 30, height: 30, borderRadius: "50%", backgroundColor: "#18181B", color: "#FFFFFF", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "0.75rem" }}>
                                  {item.initials}
                                </div>
                                <div>
                                  <strong style={{ color: "#111111", display: "block" }}>{item.advisor_name}</strong>
                                  <span style={{ fontSize: "0.72rem", color: "#71717A" }}>{item.title}</span>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: "12px 14px", textAlign: "center" }}>
                              <strong style={{ fontSize: "0.95rem", color: "#111111" }}>
                                {item.best_score.toFixed(1)}
                              </strong>
                              <span style={{ fontSize: "0.72rem", color: "#71717A" }}> / 3.0</span>
                            </td>
                            <td style={{ padding: "12px 14px", textAlign: "center" }}>
                              <span style={{ padding: "2px 8px", borderRadius: 999, backgroundColor: "#F4F4F5", border: "1px solid #E4E4E7", fontWeight: 700 }}>
                                {item.score_100}/100
                              </span>
                            </td>
                            <td style={{ padding: "12px 14px", textAlign: "center", color: "#52525B" }}>
                              {item.attempt_count} phiên
                            </td>
                            <td style={{ padding: "12px 14px", color: "#71717A", fontSize: "0.75rem" }}>
                              {formatDate(item.latest_attempt_date)}
                            </td>
                            <td style={{ padding: "12px 14px", textAlign: "right" }}>
                              <button
                                type="button"
                                className="btn-outline"
                                onClick={() => {
                                  if (onOpenReview && item.best_session_id) {
                                    onOpenReview(item.best_session_id);
                                  }
                                }}
                                style={{ padding: "5px 10px", fontSize: "0.75rem", backgroundColor: "#FFFFFF" }}
                              >
                                <span>Xem bài làm →</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
