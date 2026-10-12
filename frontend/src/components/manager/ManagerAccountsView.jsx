import { useState } from 'react';
import { managerApi } from '../../api/managerApi';

export function ManagerAccountsView() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setCreated(null);
    if (!displayName.trim() || !username.trim() || password.length < 12) {
      setError('Nhập tên, tên đăng nhập và mật khẩu ít nhất 12 ký tự.');
      return;
    }
    setStatus('saving');
    try {
      const account = await managerApi.createAdvisor({
        displayName: displayName.trim(),
        username: username.trim(),
        password,
      });
      setCreated(account);
      setDisplayName('');
      setUsername('');
      setPassword('');
      setStatus('ready');
    } catch (createError) {
      setError(createError.status === 409
        ? 'Tên đăng nhập này đã tồn tại. Vui lòng chọn tên khác.'
        : createError.message || 'Không thể tạo tài khoản. Vui lòng thử lại.');
      setStatus('error');
    }
  };

  return (
    <section className="manager-queue-card manager-account-card">
      <div className="manager-queue-heading">
        <div>
          <h2>Tạo tài khoản tư vấn viên</h2>
          <p>Chỉ quản lý được tạo tài khoản; vai trò được cố định là Advisor.</p>
        </div>
      </div>

      {error && <div className="manager-queue-error" role="alert">{error}</div>}
      {created && (
        <div className="manager-approved-note" role="status">
          Đã tạo {created.display_name} ({created.username}). Tư vấn viên sẽ phải đổi mật khẩu ngay sau lần đăng nhập đầu.
        </div>
      )}

      <form className="manager-account-form" onSubmit={submit}>
        <label>
          <span>Họ tên tư vấn viên</span>
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="off" maxLength={200} disabled={status === 'saving'} required />
        </label>
        <label>
          <span>Tên đăng nhập</span>
          <input value={username} onChange={(event) => setUsername(event.target.value)}
            autoComplete="off" maxLength={120} disabled={status === 'saving'} required />
        </label>
        <label>
          <span>Mật khẩu khởi tạo</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password" minLength={12} maxLength={1024} disabled={status === 'saving'} required />
        </label>
        <p>Chia sẻ mật khẩu khởi tạo qua kênh riêng; ứng dụng sẽ bắt buộc tư vấn viên đổi mật khẩu khi đăng nhập.</p>
        <button type="submit" disabled={status === 'saving'}>
          {status === 'saving' ? 'Đang tạo…' : 'Tạo tài khoản Advisor'}
        </button>
      </form>
    </section>
  );
}
