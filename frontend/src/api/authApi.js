import { request } from './client';

export const authApi = {
  login(username, password) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  me() {
    return request('/auth/me');
  },

  logout() {
    return request('/auth/logout', { method: 'POST' });
  },
};
