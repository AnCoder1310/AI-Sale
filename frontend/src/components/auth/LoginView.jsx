import { useState } from 'react';
import {
  VinFastLogo,
  CheckCircleIcon,
  RefreshIcon,
  AdvisorIcon,
  ManagerIcon,
  AdminIcon,
  KeyIcon,
  BuildingIcon,
  InfoIcon,
  ClockIcon,
  SparkleIcon,
  BullseyeIcon,
} from '../common/Icons';
import { authApi } from '../../api/authApi';

function FieldIcon({ type }) {
  if (type === 'password') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
        <rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }
  if (type === 'name') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
      <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function LoginView({ onLogin, initialMode = 'login' }) {
  const [activeTab, setActiveTab] = useState(initialMode); // 'login' | 'register'

  // Pre-fill demo account for 1-click test
  const [username, setUsername] = useState('advisor.demo');
  const [password, setPassword] = useState('DemoAdvisor123!');
  const [showPassword, setShowPassword] = useState(false);

  // Register form state
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Pending success state after registration
  const [registeredPendingUser, setRegisteredPendingUser] = useState(null);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!username.trim() || !password) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }
    setIsLoading(true);
    try {
      await onLogin(username.trim(), password);
    } catch (loginError) {
      setError(loginError.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = (userAccount, userPassword) => {
    setUsername(userAccount);
    setPassword(userPassword);
    setError('');
  };

  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!regFullName.trim() || !regEmail.trim() || !regPassword) {
      setError('Vui lòng điền đầy đủ các trường bắt buộc (*).');
      return;
    }
    const cleanEmail = regEmail.trim().toLowerCase();
    if (!cleanEmail.includes('@') || !cleanEmail.split('@')[1]?.includes('.')) {
      setError('Email không đúng định dạng.');
      return;
    }
    if (regPassword.length < 6) {
      setError('Mật khẩu tối thiểu 6 ký tự.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsLoading(true);
    try {
      const created = await authApi.register({
        full_name: regFullName.trim(),
        email: cleanEmail,
        password: regPassword,
        confirm_password: regConfirmPassword,
      });
      setRegisteredPendingUser(created);
    } catch (err) {
      setError(err.message || 'Đăng ký không thành công. Email có thể đã tồn tại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckStatusAfterRegister = async () => {
    if (!registeredPendingUser?.email) return;
    setIsLoading(true);
    try {
      const statusRes = await authApi.getAccountStatus(registeredPendingUser.email);
      if (statusRes.status === 'active') {
        setSuccessMsg('Tài khoản đã được kích hoạt! Đang đăng nhập…');
        setTimeout(() => {
          onLogin(registeredPendingUser.email, regPassword);
        }, 1200);
      } else {
        setSuccessMsg(statusRes.status === 'pending' ? 'Tài khoản đang chờ duyệt.' : 'Tài khoản đã bị từ chối.');
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch {
      setError('Chưa thể kiểm tra trạng thái lúc này.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="login-shell">
      {/* LEFT SHOWCASE */}
      <section className="login-showcase" aria-label="Giới thiệu VinFast AI Sales Coach">
        <div className="login-brand">
          <span className="login-logo"><VinFastLogo style={{ width: 24, height: 24 }} /></span>
          <div>
            <div className="login-brand-title">AI Sales Coach <span>Automotive SaaS</span></div>
            <p>VinFast Sales Enablement Platform</p>
          </div>
        </div>

        <div className="login-pitch">
          <span className="login-kicker">Automotive AI Platform</span>
          <h1>Empower Every Conversation.<br />Train Smarter. Sell Better.</h1>
          <p>
            Hệ thống đào tạo & trợ lý bán hàng xe điện VinFast với Copilot tra cứu chuẩn xác và phòng luyện tập đối thoại AI thích ứng.
          </p>
          <div className="login-features">
            <article>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#FFFFFF', marginBottom: 4 }}>
                <SparkleIcon style={{ width: 14, height: 14, color: '#38BDF8' }} />
                <span>Grounded Copilot</span>
              </div>
              <span>Tra cứu thông số, bảng giá và chính sách sạc từ kho dữ liệu chuẩn.</span>
            </article>
            <article>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#FFFFFF', marginBottom: 4 }}>
                <BullseyeIcon style={{ width: 14, height: 14, color: '#38BDF8' }} />
                <span>Roleplay Simulator</span>
              </div>
              <span>Luyện tập đối thoại đa kịch bản với khách hàng giả lập và chấm điểm rubric.</span>
            </article>
          </div>
        </div>

        <footer className="login-footer">
          <span>VinFast Auto Ltd. · Team P-043</span>
          <span>Nền tảng Đào tạo Showroom</span>
        </footer>
      </section>

      {/* RIGHT PANEL */}
      <section className="login-panel">
        <div className="login-form-wrap">
          <div className="login-mobile-brand">
            <span className="login-logo"><VinFastLogo style={{ width: 22, height: 22 }} /></span>
            <strong>AI Sales Coach</strong>
          </div>

          {/* Registration Pending Screen */}
          {registeredPendingUser ? (
            <div style={{ padding: '8px 0' }}>
              <div style={{
                textAlign: 'center',
                backgroundColor: '#F8FAFC',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
                padding: '24px 20px',
                marginBottom: 16
              }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  backgroundColor: '#FEF3C7',
                  color: '#D97706',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 10
                }}>
                  <ClockIcon style={{ width: 24, height: 24 }} />
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>
                  Đăng ký thành công — Đang chờ duyệt
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                  Yêu cầu của bạn đã được ghi nhận. Quản trị viên sẽ phê duyệt và phân quyền tài khoản.
                </p>
              </div>

              <div style={{
                backgroundColor: '#F8FAFC',
                borderRadius: 8,
                border: '1px solid #E2E8F0',
                padding: '14px 16px',
                marginBottom: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                fontSize: '0.82rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Họ và tên:</span>
                  <strong style={{ color: '#0F172A' }}>{registeredPendingUser.display_name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Email:</span>
                  <strong style={{ color: '#0284C7' }}>{registeredPendingUser.email || registeredPendingUser.username}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748B' }}>Trạng thái:</span>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: '#FEF3C7',
                    color: '#B45309',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    <ClockIcon style={{ width: 12, height: 12 }} />
                    Chờ duyệt (Pending)
                  </span>
                </div>
              </div>

              {error && <div className="login-error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
              {successMsg && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: '#ECFDF5',
                  color: '#065F46',
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: '0.8rem',
                  marginBottom: 12
                }}>
                  <CheckCircleIcon style={{ width: 14, height: 14 }} />
                  <span>{successMsg}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
                <button
                  type="button"
                  className="login-submit"
                  onClick={handleCheckStatusAfterRegister}
                  disabled={isLoading}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <RefreshIcon style={{ width: 14, height: 14 }} />
                  <span>{isLoading ? 'Đang kiểm tra…' : 'Kiểm tra trạng thái'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRegisteredPendingUser(null);
                    setActiveTab('login');
                    setUsername(registeredPendingUser.email || registeredPendingUser.username);
                  }}
                  style={{
                    padding: '9px 14px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#334155',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Quay lại đăng nhập
                </button>
              </div>
            </div>
          ) : (
            <>
              <header>
                <h2>{activeTab === 'login' ? 'Đăng nhập' : 'Đăng ký tài khoản'}</h2>
                <p>
                  {activeTab === 'login'
                    ? 'Hệ thống hỗ trợ bán hàng & đào tạo tư vấn viên.'
                    : 'Tạo tài khoản mới để tham gia huấn luyện.'}
                </p>
              </header>

              {/* Mode Switcher Tabs */}
              <div style={{
                display: 'flex',
                backgroundColor: '#F1F5F9',
                borderRadius: 8,
                padding: 3,
                marginBottom: 16,
                gap: 4
              }}>
                <button
                  type="button"
                  onClick={() => { setActiveTab('login'); setError(''); setSuccessMsg(''); }}
                  style={{
                    flex: 1,
                    padding: '7px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: activeTab === 'login' ? '#FFFFFF' : 'transparent',
                    fontWeight: activeTab === 'login' ? '700' : '500',
                    color: activeTab === 'login' ? '#0F172A' : '#64748B',
                    boxShadow: activeTab === 'login' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Đăng nhập
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('register'); setError(''); setSuccessMsg(''); }}
                  style={{
                    flex: 1,
                    padding: '7px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: activeTab === 'register' ? '#FFFFFF' : 'transparent',
                    fontWeight: activeTab === 'register' ? '700' : '500',
                    color: activeTab === 'register' ? '#0F172A' : '#64748B',
                    boxShadow: activeTab === 'register' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Đăng ký mới
                </button>
              </div>

              {error && <div className="login-error" role="alert">{error}</div>}
              {successMsg && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  color: '#065F46',
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: '0.8rem',
                  marginBottom: 14
                }}>
                  <CheckCircleIcon style={{ width: 14, height: 14 }} />
                  <span>{successMsg}</span>
                </div>
              )}

              {activeTab === 'login' ? (
                <>
                  <form onSubmit={handleLoginSubmit} className="login-form">
                    <label>
                      <span>Tên đăng nhập / Email</span>
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
                      {isLoading ? 'Đang xác thực…' : 'Đăng nhập'}
                    </button>
                  </form>

                  {/* QUICK DEMO ACCOUNTS SELECTOR */}
                  <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      color: '#64748B',
                      marginBottom: 10
                    }}>
                      <KeyIcon style={{ width: 13, height: 13 }} />
                      <span>Tài khoản trải nghiệm nhanh:</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => handleFillDemo('advisor.demo', 'DemoAdvisor123!')}
                        style={{
                          padding: '10px 6px',
                          borderRadius: 8,
                          border: username === 'advisor.demo' ? '1.5px solid #0F172A' : '1px solid #E2E8F0',
                          backgroundColor: username === 'advisor.demo' ? '#F8FAFC' : '#FFFFFF',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          backgroundColor: username === 'advisor.demo' ? '#0F172A' : '#F1F5F9',
                          color: username === 'advisor.demo' ? '#FFFFFF' : '#334155',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <AdvisorIcon style={{ width: 16, height: 16 }} />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <strong style={{ fontSize: '0.78rem', color: '#0F172A', display: 'block', lineHeight: 1.2 }}>Tư vấn viên</strong>
                          <span style={{ fontSize: '0.67rem', color: '#64748B' }}>advisor.demo</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleFillDemo('manager.demo', 'DemoManager123!')}
                        style={{
                          padding: '10px 6px',
                          borderRadius: 8,
                          border: username === 'manager.demo' ? '1.5px solid #0F172A' : '1px solid #E2E8F0',
                          backgroundColor: username === 'manager.demo' ? '#F8FAFC' : '#FFFFFF',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          backgroundColor: username === 'manager.demo' ? '#0F172A' : '#F1F5F9',
                          color: username === 'manager.demo' ? '#FFFFFF' : '#334155',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <ManagerIcon style={{ width: 16, height: 16 }} />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <strong style={{ fontSize: '0.78rem', color: '#0F172A', display: 'block', lineHeight: 1.2 }}>Quản lý</strong>
                          <span style={{ fontSize: '0.67rem', color: '#64748B' }}>manager.demo</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleFillDemo('admin.demo', 'DemoManager123!')}
                        style={{
                          padding: '10px 6px',
                          borderRadius: 8,
                          border: username === 'admin.demo' ? '1.5px solid #0F172A' : '1px solid #E2E8F0',
                          backgroundColor: username === 'admin.demo' ? '#F8FAFC' : '#FFFFFF',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          backgroundColor: username === 'admin.demo' ? '#0F172A' : '#F1F5F9',
                          color: username === 'admin.demo' ? '#FFFFFF' : '#334155',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <AdminIcon style={{ width: 16, height: 16 }} />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <strong style={{ fontSize: '0.78rem', color: '#0F172A', display: 'block', lineHeight: 1.2 }}>Quản trị</strong>
                          <span style={{ fontSize: '0.67rem', color: '#64748B' }}>admin.demo</span>
                        </div>
                      </button>
                    </div>

                    {/* Clean enterprise note */}
                    <div style={{
                      marginTop: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 6,
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      fontSize: '0.73rem',
                      color: '#64748B'
                    }}>
                      <BuildingIcon style={{ width: 14, height: 14, color: '#64748B', flexShrink: 0 }} />
                      <span>Hệ thống nội bộ — Nhân viên liên hệ Quản lý để cấp tài khoản.</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Clean Register Notice */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: '#EFF6FF',
                    border: '1px solid #DBEAFE',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: '0.75rem',
                    color: '#1E40AF',
                    marginBottom: 14
                  }}>
                    <InfoIcon style={{ width: 14, height: 14, flexShrink: 0 }} />
                    <span>Tài khoản mới sẽ được Quản trị viên duyệt trước khi kích hoạt.</span>
                  </div>

                  <form onSubmit={handleRegisterSubmit} className="login-form">
                    <label>
                      <span>Họ và tên *</span>
                      <span className="login-input-wrap">
                        <span className="login-field-icon"><FieldIcon type="name" /></span>
                        <input
                          value={regFullName}
                          onChange={(e) => setRegFullName(e.target.value)}
                          placeholder="Nguyễn Văn A"
                          disabled={isLoading}
                        />
                      </span>
                    </label>

                    <label>
                      <span>Email *</span>
                      <span className="login-input-wrap">
                        <span className="login-field-icon"><FieldIcon type="username" /></span>
                        <input
                          type="email"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="name@vinfast.vn"
                          disabled={isLoading}
                        />
                      </span>
                    </label>

                    <label>
                      <span>Mật khẩu * (Tối thiểu 6 ký tự)</span>
                      <span className="login-input-wrap">
                        <span className="login-field-icon"><FieldIcon type="password" /></span>
                        <input
                          type="password"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="••••••••"
                          disabled={isLoading}
                        />
                      </span>
                    </label>

                    <label>
                      <span>Xác nhận mật khẩu *</span>
                      <span className="login-input-wrap">
                        <span className="login-field-icon"><FieldIcon type="password" /></span>
                        <input
                          type="password"
                          value={regConfirmPassword}
                          onChange={(e) => setRegConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          disabled={isLoading}
                        />
                      </span>
                    </label>

                    <button className="login-submit" type="submit" disabled={isLoading}>
                      {isLoading ? 'Đang gửi…' : 'Gửi yêu cầu đăng ký'}
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

export default LoginView;
