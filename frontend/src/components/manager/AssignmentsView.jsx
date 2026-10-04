import { useState } from "react";
import {
  PlusIcon,
  RefreshIcon,
} from "../common/Icons";
import { Badge } from "../common/Badge";
import { getVehicleImage } from "../../data/vehicleData";
import { Modal } from "../common/Modal";

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

export function AssignmentsView({
  assignments = [],
  advisors = [],
  scenarios = [],
  loading = false,
  error = "",
  initialAdvisorId = "",
  onCreateAssignment,
  onRefresh,
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("Luyện tập đàm phán chỉ định");
  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const [targetVehicle, setTargetVehicle] = useState("VinFast VF 5 Plus");
  const [selectedAdvisorId, setSelectedAdvisorId] = useState(initialAdvisorId || "");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [prevAdvisorId, setPrevAdvisorId] = useState(initialAdvisorId);
  if (initialAdvisorId && initialAdvisorId !== prevAdvisorId) {
    setPrevAdvisorId(initialAdvisorId);
    setSelectedAdvisorId(initialAdvisorId);
    setShowCreateModal(true);
  }

  const handleScenarioChange = (scId) => {
    setSelectedScenarioId(scId);
    const found = scenarios.find((s) => s.scenario_id === scId);
    if (found) {
      setTargetVehicle(found.model_badge || found.model || "VinFast EV");
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError("Vui lòng nhập tiêu đề bài tập.");
      return;
    }
    if (!selectedScenarioId) {
      setFormError("Vui lòng chọn kịch bản luyện tập.");
      return;
    }
    if (!selectedAdvisorId.trim()) {
      setFormError("Vui lòng chỉ định tư vấn viên.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      await onCreateAssignment({
        title: title.trim(),
        scenario_id: selectedScenarioId || scenarios[0]?.scenario_id,
        target_vehicle: targetVehicle || (scenarios.find(s => s.scenario_id === (selectedScenarioId || scenarios[0]?.scenario_id))?.model_badge || "VinFast EV"),
        advisor_id: selectedAdvisorId.trim(),
        due_date: dueDate,
      });
      setShowCreateModal(false);
      setTitle("Luyện tập đàm phán chỉ định");
    } catch (err) {
      setFormError(err.message || "Không thể tạo bài tập. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1200, margin: "0 auto", paddingBottom: 40 }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#111111", letterSpacing: "-0.01em" }}>
            Quản Lý Bài Tập & Phân Công (Assignments)
          </h1>
          <p style={{ fontSize: "0.82rem", color: "#666666", marginTop: 4 }}>
            Chỉ định tình huống thực hành, mẫu xe mục tiêu và thời hạn nộp bài cho từng tư vấn viên
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            className="btn-outline"
            onClick={onRefresh}
            disabled={loading}
            style={{ padding: "8px 14px", fontSize: "0.82rem" }}
          >
            <RefreshIcon style={{ width: 14, height: 14 }} />
            <span>Làm mới</span>
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => { setFormError(""); setShowCreateModal(true); }}
            style={{ backgroundColor: "#2563EB", padding: "8px 16px", fontSize: "0.82rem" }}
          >
            <PlusIcon style={{ width: 14, height: 14 }} />
            <span>Tạo Assignment mới</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="manager-error-alert" role="alert">
          <span>{error}</span>
          <button type="button" onClick={onRefresh}>Thử lại</button>
        </div>
      )}

      {/* Assignments List */}
      {loading ? (
        <div style={{ padding: "48px 20px", textAlign: "center", backgroundColor: "#FFFFFF", borderRadius: 16, border: "1px solid #E5E5E5" }}>
          <div style={{ fontSize: "0.9rem", color: "#737373" }}>Đang tải danh sách bài tập…</div>
        </div>
      ) : assignments.length === 0 ? (
        <div style={{ padding: "56px 20px", textAlign: "center", backgroundColor: "#FFFFFF", borderRadius: 16, border: "1px dashed #E5E5E5" }}>
          <div style={{ fontSize: "2.2rem", marginBottom: 12 }}>📋</div>
          <strong style={{ fontSize: "1.05rem", color: "#111111", display: "block" }}>
            Chưa có bài tập nào
          </strong>
          <p style={{ fontSize: "0.85rem", color: "#666666", maxWidth: 440, margin: "6px auto 16px" }}>
            Tạo bài tập đầu tiên để bắt đầu giao nhiệm vụ và rèn luyện kỹ năng cho đội ngũ tư vấn viên.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{ backgroundColor: "#2563EB", margin: "0 auto", padding: "8px 18px", fontSize: "0.82rem" }}
          >
            <PlusIcon style={{ width: 14, height: 14 }} />
            <span>Giao bài tập đầu tiên</span>
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 18 }}>
          {assignments.map((asg) => {
            const isCompleted = asg.status === "completed";
            return (
              <div
                key={asg.assignment_id}
                className="card-white card-white-hover"
                style={{ padding: 22, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 16 }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Badge variant="highlight">{asg.target_vehicle}</Badge>
                      <Badge variant={isCompleted ? "default" : "highlight"}>
                        {isCompleted ? "✓ Đã hoàn thành" : "⏳ Đang thực hiện"}
                      </Badge>
                    </div>
                    {getVehicleImage(asg.target_vehicle) && (
                      <div
                        style={{
                          width: 52,
                          height: 32,
                          borderRadius: 6,
                          overflow: "hidden",
                          flexShrink: 0,
                          backgroundColor: "#141722",
                          border: "1px solid #E5E7EB",
                        }}
                      >
                        <img
                          src={getVehicleImage(asg.target_vehicle)}
                          alt={asg.target_vehicle}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </div>
                    )}
                  </div>

                  <h3 style={{ fontSize: "1.02rem", fontWeight: 700, color: "#111111", lineHeight: 1.35, marginBottom: 4 }}>
                    {asg.title}
                  </h3>
                  <p style={{ fontSize: "0.8rem", color: "#666666", lineHeight: 1.4 }}>
                    Kịch bản: <strong>{asg.scenario_title || asg.scenario_id}</strong>
                  </p>

                  <div
                    style={{
                      marginTop: 14,
                      padding: "12px 14px",
                      backgroundColor: "#F9F9F8",
                      borderRadius: 10,
                      border: "1px solid #ECECE8",
                      fontSize: "0.78rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div>
                      <span style={{ color: "#737373" }}>Tư vấn viên: </span>
                      <strong style={{ color: "#111111" }}>{asg.advisor_name || asg.advisor_id}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#737373" }}>Hạn hoàn thành: </span>
                      <strong style={{ color: "#111111" }}>{formatDate(asg.due_date)}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: "0.72rem", color: "#888888", borderTop: "1px solid #F0F0EE", paddingTop: 10 }}>
                  Giao bởi <strong>{asg.manager_id}</strong> • {formatDate(asg.created_at)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Assignment Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Giao Bài Luyện Tập Cho Tư Vấn Viên"
        maxWidth={580}
      >
        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {formError && (
            <div className="manager-error-alert" role="alert">
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#222222", marginBottom: 6 }}>
              Tiêu đề nhiệm vụ:
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Luyện tập xử lý phản đối pin VF 5 Plus"
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #D4D4D8",
                fontSize: "0.85rem",
                outline: "none",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#222222", marginBottom: 6 }}>
              Chọn tình huống luyện tập:
            </label>
            <select
              value={selectedScenarioId || scenarios[0]?.scenario_id || ""}
              onChange={(e) => handleScenarioChange(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #D4D4D8",
                fontSize: "0.85rem",
                backgroundColor: "#FFFFFF",
                outline: "none",
              }}
            >
              {scenarios.map((s) => (
                <option key={s.scenario_id} value={s.scenario_id}>
                  {s.title} ({s.model_badge || s.model})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#222222", marginBottom: 6 }}>
                Mẫu xe mục tiêu:
              </label>
              <input
                type="text"
                value={targetVehicle}
                onChange={(e) => setTargetVehicle(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #D4D4D8",
                  fontSize: "0.85rem",
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#222222", marginBottom: 6 }}>
                Hạn hoàn thành:
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #D4D4D8",
                  fontSize: "0.85rem",
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#222222", marginBottom: 6 }}>
              Chỉ định tư vấn viên:
            </label>
            {advisors.length > 0 ? (
              <select
                value={selectedAdvisorId}
                onChange={(e) => setSelectedAdvisorId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #D4D4D8",
                  fontSize: "0.85rem",
                  backgroundColor: "#FFFFFF",
                  outline: "none",
                }}
              >
                <option value="">-- Chọn tư vấn viên --</option>
                {advisors.map((a) => (
                  <option key={a.advisor_id} value={a.advisor_id}>
                    {a.advisor_name || a.advisor_id} ({a.advisor_id})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={selectedAdvisorId}
                onChange={(e) => setSelectedAdvisorId(e.target.value)}
                placeholder="VD: advisor-demo hoặc tên tài khoản"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #D4D4D8",
                  fontSize: "0.85rem",
                  outline: "none",
                }}
              />
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12, paddingTop: 14, borderTop: "1px solid #F0F0EE" }}>
            <button
              type="button"
              className="btn-outline"
              onClick={() => setShowCreateModal(false)}
              disabled={submitting}
              style={{ padding: "8px 16px", fontSize: "0.82rem" }}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting}
              style={{ backgroundColor: "#2563EB", padding: "8px 20px", fontSize: "0.82rem" }}
            >
              {submitting ? "Đang lưu…" : "Xác nhận giao bài"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
