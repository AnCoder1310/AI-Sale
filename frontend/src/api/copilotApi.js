import { request } from './client.js';

export const copilotApi = {
  async query({ query, target_date, session_id, customer_context, domain }) {
    return request('/copilot/query', {
      method: 'POST',
      body: JSON.stringify({
        query: query.trim(),
        target_date: target_date || undefined,
        session_id: session_id || undefined,
        customer_context,
        domain,
      }),
    });
  },

  async queryStream(
    { query, target_date, session_id, customer_context, domain },
    { onStatus, onDelta, onFinal, onInsights, onError }
  ) {
    const url = '/api/v1/copilot/query/stream';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        query: query.trim(),
        target_date: target_date || undefined,
        session_id: session_id || undefined,
        customer_context,
        domain,
      }),
    });

    if (!response.ok) {
      let errDetail;
      try {
        const errJson = await response.json();
        errDetail = errJson.detail || errJson.message || response.statusText;
      } catch {
        errDetail = await response.text().catch(() => response.statusText);
      }
      throw new Error(errDetail || `Lỗi kết nối Copilot (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let receivedFinal = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        if (!block.trim()) continue;
        let eventType = 'message';
        let dataStr = '';
        const lines = block.split('\n');
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            dataStr = line.slice(6).trim();
          }
        }
        if (dataStr) {
          let data;
          try {
            data = JSON.parse(dataStr);
          } catch (parseErr) {
            console.warn('Error parsing SSE event data', parseErr);
            continue;
          }

          if (eventType === 'status') {
            if (onStatus) onStatus(data);
          } else if (eventType === 'delta') {
            if (onDelta) onDelta(data);
          } else if (eventType === 'insights') {
            if (onInsights) onInsights(data);
          } else if (eventType === 'final') {
            receivedFinal = true;
            if (onFinal) onFinal(data);
          } else if (eventType === 'error') {
            const errMsg = data.error || data.detail || 'Lỗi xử lý yêu cầu';
            if (onError) onError(new Error(errMsg));
            throw new Error(errMsg);
          }
        }
      }
    }

    if (!receivedFinal) {
      const streamErr = new Error('Kết nối dòng dữ liệu Copilot bị ngắt trước khi hoàn tất.');
      if (onError) onError(streamErr);
      throw streamErr;
    }
  },

  async getSessions() {
    return request('/copilot/sessions', {
      method: 'GET',
    });
  },

  async getSessionDetail(sessionId) {
    if (!sessionId) return null;
    return request(`/copilot/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'GET',
    });
  },

  async resetSession(sessionId) {
    if (!sessionId) return;
    return request(`/copilot/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
  },

  async deleteSession(sessionId) {
    if (!sessionId) return;
    return request(`/copilot/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
  },

  async getSource(documentId, chunkId = null) {
    const query = chunkId ? `?chunk_id=${encodeURIComponent(chunkId)}` : '';
    return request(`/copilot/sources/${encodeURIComponent(documentId)}${query}`, {
      method: 'GET',
    });
  },

  async ingest() {
    return request('/copilot/ingest', {
      method: 'POST',
    });
  },
};
