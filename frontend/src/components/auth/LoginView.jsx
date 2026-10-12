import { useState } from 'react';

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
          <span className="login-logo"><img src="/vinfast-official-logo.png" alt="VinFast" /></span>
          <div>
            <div className="login-brand-title">AI Sales Coach &amp; Co-pilot</div>
            <p>Nền tảng đào tạo và hỗ trợ tư vấn bán hàng ô tô</p>
          </div>
        </div>

        <div className="login-pitch">
          <h1>Luyện tập tốt hơn.<br />Tư vấn tự tin hơn.</h1>
          <p>
            Mô phỏng hội thoại khách hàng, tra cứu thông tin có nguồn<br className="login-desktop-break" />
            {' '}và đánh giá kỹ năng trong một hệ thống thống nhất.
          </p>
          <div className="login-features">
            <article>
              <span className="login-feature-icon"><img src="/tra-cuu-co-nguon.svg" alt="" /></span>
              <strong>Tra cứu<br />có nguồn</strong>
            </article>
            <article>
              <span className="login-feature-icon"><img src="/luyen-tap-tinh-huong.svg" alt="" /></span>
              <strong>Luyện tập<br />theo tình huống</strong>
            </article>
            <article>
              <span className="login-feature-icon"><img src="/danh-gia-ky-nang.svg" alt="" /></span>
              <strong>Đánh giá<br />kỹ năng</strong>
            </article>
          </div>
        </div>

        <footer className="login-footer">
          Đồng hành cùng đội ngũ bán hàng<br />
          kiến tạo trải nghiệm khách hàng xuất sắc.
        </footer>
      </section>

      <section className="login-panel">
        <div className="login-form-wrap">
          <div className="login-mobile-brand">
            <span className="login-logo"><img src="/vinfast-official-logo.png" alt="VinFast" /></span>
            <strong>AI Sales Coach &amp; Co-pilot</strong>
          </div>
          <header>
            <h2>Chào mừng bạn trở lại</h2>
            <p>Đăng nhập để tiếp tục sử dụng hệ thống.</p>
          </header>

          {error && <div className="login-error" role="alert">{error}</div>}

          <form onSubmit={submit} className="login-form">
            <label>
              <span>Email hoặc tên đăng nhập</span>
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
              {isLoading ? 'Đang đăng nhập…' : 'Đăng nhập  →'}
            </button>
          </form>

          <div className="login-divider" aria-hidden="true"><span>Hoặc</span></div>

          <div className="login-demo">
            <span>Dùng thử nhanh</span>
            <p>Chọn tài khoản mẫu theo vai trò rồi nhập mật khẩu để đăng nhập.</p>
            <div>
              <button type="button" onClick={() => setUsername('advisor.demo')}>Tư vấn viên →</button>
              <button type="button" onClick={() => setUsername('manager.demo')}>Quản lý →</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
