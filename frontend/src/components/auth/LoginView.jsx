import { useState } from 'react';
import { VinFastLogo } from '../common/Icons';

function FieldIcon({ type }) {
  if (type === 'password') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

export function LoginView({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Vui lòng nhập tên đăng nhập và mật khẩu.');
      return;
    }
    setIsLoading(true);
    try {
      await onLogin(username.trim(), password);
    } catch (loginError) {
      setError(loginError.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-showcase" aria-label="Giới thiệu AI Sales Coach">
        <div className="login-brand">
          <span className="login-logo"><VinFastLogo style={{ width: 24, height: 24 }} /></span>
          <div>
            <div className="login-brand-title">AI Sales Coach <span>Automotive SaaS</span></div>
            <p>VinFast Automotive Sales Enablement Platform</p>
          </div>
        </div>

        <div className="login-pitch">
          <span className="login-kicker">✦ Next-Gen Automotive AI Assistant</span>
          <h1>“Empower every conversation.<br />Train smarter. Sell better.”</h1>
          <p>
            Huấn luyện kỹ năng tư vấn bán xe điện qua hội thoại đa lượt với AI Customer,
            tra cứu thông tin có trích nguồn và đánh giá theo rubric rõ ràng.
          </p>
          <div className="login-features">
            <article>
              <strong>⌁ Grounded Copilot</strong>
              <span>Tra cứu sản phẩm và chính sách từ kho kiến thức.</span>
            </article>
            <article>
              <strong>◇ Human-In-The-Loop</strong>
              <span>Quản lý duyệt và hiệu chỉnh đánh giá AI minh bạch.</span>
            </article>
          </div>
        </div>

        <footer className="login-footer">
          <span>VinFast Auto Ltd. · Đề án AI20K Team P-043</span>
          <span>MVP nội bộ</span>
        </footer>
      </section>

      <section className="login-panel">
        <div className="login-form-wrap">
          <div className="login-mobile-brand">
            <span className="login-logo"><VinFastLogo style={{ width: 22, height: 22 }} /></span>
            <strong>AI Sales Coach</strong>
          </div>
          <header>
            <h2>Welcome back</h2>
            <p>Đăng nhập để tiếp tục vào không gian làm việc.</p>
          </header>

          {error && <div className="login-error" role="alert">{error}</div>}

          <form onSubmit={submit} className="login-form">
            <label>
              <span>Tên đăng nhập</span>
              <span className="login-input-wrap">
                <span className="login-field-icon"><FieldIcon type="username" /></span>
                <input
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="advisor.demo"
                  disabled={isLoading}
                />
              </span>
            </label>

            <label>
              <span>Mật khẩu</span>
              <span className="login-input-wrap">
                <span className="login-field-icon"><FieldIcon type="password" /></span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Nhập mật khẩu"
                  disabled={isLoading}
                />
                <button
                  className="login-password-toggle"
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? 'Ẩn' : 'Hiện'}
                </button>
              </span>
            </label>

            <button className="login-submit" type="submit" disabled={isLoading}>
              {isLoading ? 'Đang đăng nhập…' : 'Sign in  →'}
            </button>
          </form>

          <div className="login-demo">
            <span>Tài khoản dùng thử — chỉ điền tên đăng nhập</span>
            <div>
              <button type="button" onClick={() => setUsername('advisor.demo')}>Advisor</button>
              <button type="button" onClick={() => setUsername('manager.demo')}>Manager</button>
            </div>
            <p>Mật khẩu được cấu hình cục bộ khi seed database và không được lưu trong frontend.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
