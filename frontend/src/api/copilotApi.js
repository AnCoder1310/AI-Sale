import { request } from './client';

export const copilotApi = {
  async query({ query, target_date }) {
    return request('/copilot/query', {
      method: 'POST',
      body: JSON.stringify({
        query: query.trim(),
        target_date: target_date || undefined,
      }),
    });
  },

  async getSource(documentId) {
    return request(`/copilot/sources/${encodeURIComponent(documentId)}`, {
      method: 'GET',
    });
  },

  async ingest() {
    return request('/copilot/ingest', {
      method: 'POST',
    });
  },
};
