import { request } from './client';

export const authApi = {
  async register({ full_name, email, password, confirm_password, username, display_name }) {
    const user = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name: full_name || display_name,
        display_name: full_name || display_name,
        email: email || username,
        username: username || email,
        password,
        confirm_password: confirm_password || password,
        role: 'advisor',
      }),
    });
    return user;
  },

  async login(username, password) {
    const user = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: username.trim(), password }),
    });
    if (user && user.token) {
      try {
        localStorage.setItem('vinfast_auth_token', user.token);
      } catch {
        // Ignore quota
      }
    }
    return user;
  },

  me() {
    return request('/auth/me');
  },

  getAccountStatus(identifier) {
    const query = identifier ? `?identifier=${encodeURIComponent(identifier)}` : '';
    return request(`/auth/account-status${query}`);
  },

  async logout() {
    try {
      localStorage.removeItem('vinfast_auth_token');
    } catch {
      // Ignore
    }
    return request('/auth/logout', { method: 'POST' });
  },
};
