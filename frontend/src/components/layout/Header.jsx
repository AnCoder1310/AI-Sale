import { useState } from 'react';
import {
  VinFastLogo,
  RobotIcon,
  RoleplayIcon,
  BookIcon,
  BoltIcon,
  ProgressIcon,
  BellIcon,
  LogoutIcon,
  ChevronDown,
} from '../common/Icons';

export function Header({
  currentTab,
  onTabChange,
  unreadCount = 0,
  onOpenNotifications,
  advisorProfile,
}) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const tabs = [
    { id: 'home', label: 'Home' },
    { id: 'copilot', label: 'AI Copilot', icon: <RobotIcon style={{ width: 15, height: 15 }} /> },
    { id: 'roleplay', label: 'Role-play', icon: <RoleplayIcon style={{ width: 15, height: 15 }} /> },
    { id: 'knowledge', label: 'Knowledge', icon: <BookIcon style={{ width: 15, height: 15 }} /> },
    { id: 'charging', label: 'Charging Stations', icon: <BoltIcon style={{ width: 15, height: 15 }} /> },
    { id: 'progress', label: 'Progress', icon: <ProgressIcon style={{ width: 15, height: 15 }} /> },
  ];

  return (
    <header className="top-header">
      <div className="top-header-inner">
        {/* BRAND LOGO */}
        <div className="brand-section" onClick={() => onTabChange('home')} role="button" tabIndex={0}>
          <div className="brand-logo-badge">
            <VinFastLogo style={{ width: 22, height: 22 }} />
          </div>
          <div className="brand-info">
            <span className="brand-title">AI Sales Coach</span>
            <span className="brand-subtitle">{advisorProfile.branch || 'VinFast Vinh, Nghệ An'}</span>
          </div>
        </div>

        {/* NAVIGATION PILL TABS */}
        <nav className="nav-tabs-pill" aria-label="Main Navigation">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`nav-tab-item ${isActive ? 'active' : ''}`}
                onClick={() => onTabChange(tab.id)}
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* HEADER ACTIONS */}
        <div className="header-actions">
          {/* Notifications button */}
          <button
            className="icon-badge-btn"
            onClick={onOpenNotifications}
            aria-label="Thông báo"
            title="Thông báo"
          >
            <BellIcon style={{ width: 16, height: 16 }} />
            {unreadCount > 0 && <span className="notif-badge-pill">{unreadCount}</span>}
          </button>

          {/* Logout button */}
          <button
            className="header-logout-btn"
            onClick={() => alert('Phiên làm việc của bạn đang an toàn.')}
            title="Đăng xuất"
          >
            <LogoutIcon style={{ width: 14, height: 14 }} />
            <span style={{ display: 'none' }}>Đăng xuất</span>
          </button>

          {/* User profile capsule */}
          <div style={{ position: 'relative' }}>
            <div
              className="user-profile-badge"
              onClick={() => setShowProfileMenu((prev) => !prev)}
              role="button"
              tabIndex={0}
            >
              <img
                src={advisorProfile.avatar}
                alt={advisorProfile.name}
                className="user-avatar-img"
              />
              <div className="user-details">
                <span className="user-name">{advisorProfile.name}</span>
                <span className="user-role">{advisorProfile.role}</span>
              </div>
              <ChevronDown style={{ width: 12, height: 12, color: '#8b8f9a', marginLeft: 2 }} />
            </div>

            {showProfileMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 8,
                  width: 220,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                  border: '1px solid #E5E5E5',
                  padding: 8,
                  zIndex: 60,
                }}
              >
                <div style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0EE' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111111' }}>{advisorProfile.name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#737373' }}>{advisorProfile.branch}</div>
                  <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600, marginTop: 4 }}>
                    Chỉ số tư vấn: {advisorProfile.overall_score} / 100
                  </div>
                </div>
                <button
                  onClick={() => {
                    onTabChange('progress');
                    setShowProfileMenu(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    color: '#333333',
                    borderRadius: 6,
                    display: 'block',
                  }}
                >
                  Xem hồ sơ năng lực
                </button>
                <button
                  onClick={() => {
                    alert('Chức năng cài đặt tài khoản');
                    setShowProfileMenu(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    color: '#333333',
                    borderRadius: 6,
                    display: 'block',
                  }}
                >
                  Cài đặt tài khoản
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
