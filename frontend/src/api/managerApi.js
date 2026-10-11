import { request } from './client';

export const managerApi = {
  getReviewQueue() {
    return request('/manager/reviews');
  },

  getAttempts({ advisorId = '', scenarioId = '', limit = 20, offset = 0 } = {}) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (advisorId.trim()) params.set('advisor_id', advisorId.trim());
    if (scenarioId.trim()) params.set('scenario_id', scenarioId.trim());
    return request(`/manager/attempts?${params}`);
  },

  getTeamOverview() {
    return request('/manager/overview');
  },

  getReviewDetail(sessionId) {
    return request(`/manager/reviews/${encodeURIComponent(sessionId)}`);
  },

  getVoiceUsage(sessionId) {
    return request(`/manager/reviews/${encodeURIComponent(sessionId)}/voice/usage`);
  },

  approveReview(sessionId, decision) {
    return request(`/manager/reviews/${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      body: JSON.stringify(decision),
    });
  },
};
