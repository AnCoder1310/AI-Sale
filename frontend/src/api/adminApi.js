import { request } from './client';

export const adminApi = {
  async getApprovals({ status = 'pending', search = '', page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.set('status', status);
    if (search && search.trim()) params.set('search', search.trim());
    if (page) params.set('page', String(page));
    if (limit) params.set('limit', String(limit));
    return request(`/admin/approvals?${params.toString()}`);
  },

  async approveUser(userId, role = 'advisor') {
    return request(`/admin/approvals/${encodeURIComponent(userId)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
  },

  async rejectUser(userId, reason) {
    return request(`/admin/approvals/${encodeURIComponent(userId)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async getAuditLogs(limit = 50) {
    return request(`/admin/approvals/audit-logs?limit=${limit}`);
  },
};
