import {
  VinFastLogo,
  RobotIcon,
  RoleplayIcon,
  BookIcon,
  BoltIcon,
  ProgressIcon,
  BellIcon,
} from '../common/Icons';

export function Header({
  currentTab,
  onTabChange,
  unreadCount = 0,
  onOpenNotifications,
  advisorProfile,
  onLogout,
}) {
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
            <VinFastLogo style={{ width: 26, height: 26 }} />
          </div>
          <div className="brand-info">
            <span className="brand-title">VINFAST</span>
            <span className="brand-subtitle">AI Sales Coach</span>
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

          {/* Local MVP has no authentication or individual competency profile. */}
          <div className="user-profile-badge">
              <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: '50%', background: '#333333', color: '#FFFFFF', display: 'grid', placeItems: 'center' }}>TV</span>
              <div className="user-details">
                <span className="user-name">{advisorProfile.name}</span>
                <span className="user-role">{advisorProfile.role}</span>
              </div>
          </div>
          <button className="header-logout-btn" type="button" onClick={onLogout}>
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  );
}
