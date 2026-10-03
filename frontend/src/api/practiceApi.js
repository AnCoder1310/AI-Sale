import { request } from './client';

export const practiceApi = {
  async getScenarios() {
    return request('/practice/scenarios', {
      method: 'GET',
    });
  },

  async startSession(scenarioId) {
    return request('/practice/sessions', {
      method: 'POST',
      body: JSON.stringify({ scenario_id: scenarioId }),
    });
  },

  async sendMessage(sessionId, message) {
    return request(`/practice/${encodeURIComponent(sessionId)}/message`, {
      method: 'POST',
      body: JSON.stringify({ message: message.trim() }),
    });
  },

  async finishSession(sessionId) {
    return request(`/practice/${encodeURIComponent(sessionId)}/finish`, {
      method: 'POST',
    });
  },

  async getResult(sessionId) {
    return request(`/practice/${encodeURIComponent(sessionId)}/result`, {
      method: 'GET',
    });
  },

  async getSession(sessionId) {
    return request(`/practice/${encodeURIComponent(sessionId)}`, {
      method: 'GET',
    });
  },

  async getHistory(scenarioId = null) {
    const query = scenarioId ? `?scenario_id=${encodeURIComponent(scenarioId)}` : '';
    return request(`/practice/history${query}`, { method: 'GET' });
  },

  async getAttempt(sessionId) {
    return request(`/practice/${encodeURIComponent(sessionId)}/attempt`, { method: 'GET' });
  },
};
