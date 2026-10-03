import { request } from './client';

export const managerApi = {
  getReviewQueue() {
    return request('/manager/reviews');
  },

  getReviewDetail(sessionId) {
    return request(`/manager/reviews/${encodeURIComponent(sessionId)}`);
  },

  approveReview(sessionId, decision) {
    return request(`/manager/reviews/${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      body: JSON.stringify(decision),
    });
  },
};
