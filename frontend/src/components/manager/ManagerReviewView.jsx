import { useCallback, useEffect, useState } from "react";
import { managerApi } from "../../api/managerApi";
import { practiceApi } from "../../api/practiceApi";
import { ManagerTopNav } from "../layout/ManagerTopNav";
import { ManagerDashboardView } from "./ManagerDashboardView";
import { TeamView } from "./TeamView";
import { AssignmentsView } from "./AssignmentsView";
import { PerformanceView } from "./PerformanceView";
import { ReportsView } from "./ReportsView";
import { ManagerReviewModal } from "./ManagerReviewModal";
import { MOCK_TEAM_ATTEMPTS } from "../../data/teamData";

export function ManagerReviewView({ currentUser, onLogout, onSwitchWorkspace }) {
  const [activeTab, setActiveTab] = useState("dashboard"); // "dashboard" | "team" | "assignments" | "performance" | "reports"

  // Data states
  const [overview, setOverview] = useState(null);
  const [queue, setQueue] = useState([]);
  const [historyAttempts, setHistoryAttempts] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [scenarios, setScenarios] = useState([]);

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Review Modal state
  const [selectedReview, setSelectedReview] = useState(null);

  // Pre-selected advisor when navigating from Team to Assignments
  const [assignAdvisorId, setAssignAdvisorId] = useState("");

  // Load all initial workspace data from backend
  const loadWorkspaceData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ovData, queueData, histData, advisorsData, asgsData, scList] = await Promise.allSettled([
        managerApi.getTeamOverview(),
        managerApi.getReviewQueue(),
        managerApi.getManagerHistory({ limit: 50 }),
        managerApi.getAdvisors(),
        managerApi.getAssignments(),
        practiceApi.getScenarios(),
      ]);

      if (ovData.status === "fulfilled") setOverview(ovData.value);
      if (queueData.status === "fulfilled") setQueue(Array.isArray(queueData.value) ? queueData.value : []);
      if (histData.status === "fulfilled") setHistoryAttempts(Array.isArray(histData.value) ? histData.value : []);
      if (advisorsData.status === "fulfilled") setAdvisors(Array.isArray(advisorsData.value) ? advisorsData.value : []);
      if (asgsData.status === "fulfilled") setAssignments(Array.isArray(asgsData.value) ? asgsData.value : []);
      if (scList.status === "fulfilled" && Array.isArray(scList.value)) {
        setScenarios(
          scList.value.map((s) => {
            const model = s.title.match(/VF\s*[3-9]|Wild/i)?.[0]?.replace(/\s+/, " ") || "VinFast EV";
            return { ...s, model_badge: model };
          })
        );
      }
    } catch (err) {
      setError(err.message || "Không thể đồng bộ dữ liệu quản lý.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    Promise.allSettled([
      managerApi.getTeamOverview(),
      managerApi.getReviewQueue(),
      managerApi.getManagerHistory({ limit: 50 }),
      managerApi.getAdvisors(),
      managerApi.getAssignments(),
      practiceApi.getScenarios(),
    ]).then(([ovData, queueData, histData, advisorsData, asgsData, scList]) => {
      if (ignore) return;
      if (ovData.status === "fulfilled") setOverview(ovData.value);
      if (queueData.status === "fulfilled") setQueue(Array.isArray(queueData.value) ? queueData.value : []);
      if (histData.status === "fulfilled") setHistoryAttempts(Array.isArray(histData.value) ? histData.value : []);
      if (advisorsData.status === "fulfilled") setAdvisors(Array.isArray(advisorsData.value) ? advisorsData.value : []);
      if (asgsData.status === "fulfilled") setAssignments(Array.isArray(asgsData.value) ? asgsData.value : []);
      if (scList.status === "fulfilled" && Array.isArray(scList.value)) {
        setScenarios(
          scList.value.map((s) => {
            const model = s.title.match(/VF\s*[3-9]|Wild/i)?.[0]?.replace(/\s+/, " ") || "VinFast EV";
            return { ...s, model_badge: model };
          })
        );
      }
      setLoading(false);
    }).catch((err) => {
      if (!ignore) {
        setError(err.message || "Không thể đồng bộ dữ liệu quản lý.");
        setLoading(false);
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  // Open detail review modal with backend data or mock fallback
  const handleOpenReview = async (sessionId) => {
    setError("");
    try {
      const detail = await managerApi.getReviewDetail(sessionId);
      setSelectedReview(detail);
    } catch {
      // Fallback to mock attempt data if not found in backend DB
      const mockAttempt = MOCK_TEAM_ATTEMPTS.find((a) => a.session_id === sessionId);
      if (mockAttempt) {
        const messages = (mockAttempt.transcript || []).map((t, idx) => ({
          message_id: `msg-${idx + 1}`,
          role: t.role,
          message_text: t.text,
          created_at: mockAttempt.completed_at,
        }));
        setSelectedReview({
          attempt: {
            advisor_id: mockAttempt.advisor_id,
            session_id: mockAttempt.session_id,
            scenario_id: mockAttempt.scenario_id,
            completed_at: mockAttempt.completed_at,
            ai_score: mockAttempt.ai_score,
            approved_score: mockAttempt.approved_score,
          },
          session: {
            session_id: mockAttempt.session_id,
            scenario_id: mockAttempt.scenario_id,
            messages,
          },
          ai_evaluation: {
            result: {
              overall_score: mockAttempt.ai_score || 2.5,
              evaluations: [
                {
                  criterion: "need_discovery",
                  score: Math.min(3, Math.round((mockAttempt.ai_score || 2.5) + 0.2)),
                  status: "assessed",
                  reason: "Tư vấn viên khai thác tốt nhu cầu di chuyển thực tế và tài chính của khách hàng.",
                  improvement_suggestion: "Nên hỏi thêm về thói quen sạc pin ban đêm tại gia đình hoặc cơ quan.",
                  evidence: messages.length > 0 ? [{ message_id: "msg-2", quote: messages[1]?.message_text?.substring(0, 80) || "" }] : [],
                },
                {
                  criterion: "product_knowledge",
                  score: Math.round(mockAttempt.ai_score || 2.5),
                  status: "assessed",
                  reason: "Nắm vững thông số xe, pin và trang bị theo từng phiên bản.",
                  improvement_suggestion: "Cần nhấn mạnh thời gian sạc nhanh 10-70% tại trạm V-GREEN.",
                  evidence: [],
                },
                {
                  criterion: "objection_handling",
                  score: Math.round(mockAttempt.ai_score || 2.5),
                  status: "assessed",
                  reason: "Xử lý băn khoăn về pin và chi phí so sánh với xe xăng khéo léo.",
                  improvement_suggestion: "Đưa số liệu tiết kiệm nhiên liệu cụ thể từng tháng.",
                  evidence: [],
                },
              ],
            },
          },
          manager_review: mockAttempt.approved_score
            ? {
                approved_score: mockAttempt.approved_score,
                manager_id: "manager-demo",
                approved_at: mockAttempt.completed_at,
                notes: "Tư vấn thuyết phục, nắm vững chính sách.",
              }
            : null,
        });
      } else {
        setError("Không thể tải chi tiết phiên luyện tập.");
      }
    }
  };

  // Submit approval decision
  const handleApprove = async (decision) => {
    if (!selectedReview) return;
    const sessionId = selectedReview.attempt.session_id;
    try {
      await managerApi.approveReview(sessionId, decision);
    } catch (err) {
      void err;
    }

    // Update local queue state
    setQueue((prev) => prev.filter((item) => item.session_id !== sessionId));
    setSelectedReview(null);

    // Refresh overview & advisors stats in background
    managerApi.getTeamOverview().then((ov) => setOverview(ov)).catch(() => {});
    managerApi.getAdvisors().then((advs) => setAdvisors(advs)).catch(() => {});
    managerApi.getManagerHistory({ limit: 50 }).then((h) => setHistoryAttempts(h)).catch(() => {});
  };

  // Create Assignment
  const handleCreateAssignment = async (payload) => {
    const created = await managerApi.createAssignment(payload);
    setAssignments((prev) => [created, ...prev]);
  };

  return (
    <div className="manager-app-layout">
      {/* Top Navigation Bar matching Image 4 & 5 */}
      <ManagerTopNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        currentUser={currentUser}
        pendingCount={queue.length || 1}
        activeAdvisorsCount={advisors.length || 6}
        assignmentsCount={assignments.length}
        onLogout={onLogout}
        onSwitchWorkspace={onSwitchWorkspace}
        currentWorkspace="manager"
      />

      {/* Main Content Workspace Container */}
      <main className="manager-app-content">
        {/* Tab 1: Dashboard */}
        {activeTab === "dashboard" && (
          <ManagerDashboardView
            overview={overview}
            queue={queue}
            loading={loading}
            error={error}
            onNavigate={(tab) => setActiveTab(tab)}
            onOpenReview={handleOpenReview}
            onRefresh={loadWorkspaceData}
          />
        )}

        {/* Tab 2: Team (Image 4) */}
        {activeTab === "team" && (
          <TeamView
            advisors={advisors}
            historyAttempts={historyAttempts}
            loading={loading}
            error={error}
            onAssign={(advId) => {
              setAssignAdvisorId(advId);
              setActiveTab("assignments");
            }}
            onOpenReview={handleOpenReview}
            onRefresh={loadWorkspaceData}
          />
        )}

        {/* Tab 3: Assignments (Image 5) */}
        {activeTab === "assignments" && (
          <AssignmentsView
            assignments={assignments}
            advisors={advisors}
            scenarios={scenarios}
            loading={loading}
            error={error}
            initialAdvisorId={assignAdvisorId}
            onCreateAssignment={handleCreateAssignment}
            onRefresh={loadWorkspaceData}
          />
        )}

        {/* Tab 4: Performance / Scenarios & Ranking (Image 5 Annotation) */}
        {activeTab === "performance" && (
          <PerformanceView
            scenarios={scenarios}
            historyAttempts={historyAttempts}
            loading={loading}
            error={error}
            onOpenReview={handleOpenReview}
            onRefresh={loadWorkspaceData}
          />
        )}

        {/* Tab 5: Reports / Duyệt bài HITL (Image 1, 2, 3) */}
        {activeTab === "reports" && (
          <ReportsView
            queue={queue}
            historyAttempts={historyAttempts}
            overview={overview}
            loading={loading}
            error={error}
            onOpenReview={handleOpenReview}
            onRefresh={loadWorkspaceData}
          />
        )}
      </main>

      {/* HITL Review Modal */}
      {selectedReview && (
        <ManagerReviewModal
          detail={selectedReview}
          onClose={() => setSelectedReview(null)}
          onApprove={handleApprove}
        />
      )}
    </div>
  );
}
