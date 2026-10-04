import { request } from "./client";

export const managerApi = {
  getReviewQueue() {
    return request("/manager/reviews");
  },

  getReviewDetail(sessionId) {
    return request(`/manager/reviews/${encodeURIComponent(sessionId)}`);
  },

  approveReview(sessionId, decision) {
    return request(`/manager/reviews/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      body: JSON.stringify(decision),
    });
  },

  getTeamOverview() {
    return request("/manager/overview");
  },

  getManagerHistory({ advisorId, scenarioId, limit = 50, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (advisorId) params.set("advisor_id", advisorId);
    if (scenarioId) params.set("scenario_id", scenarioId);
    if (limit) params.set("limit", String(limit));
    if (offset) params.set("offset", String(offset));
    const qs = params.toString();
    return request(`/manager/history${qs ? "?" + qs : ""}`);
  },

  getAdvisors() {
    return request("/manager/advisors");
  },

  getAssignments() {
    return request("/manager/assignments");
  },

  createAssignment(payload) {
    return request("/manager/assignments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
