import {
  VinFastLogo,
  DashboardIcon,
  CheckCircleIcon,
  ClipboardIcon,
  TrophyIcon,
  LogoutIcon,
} from "../common/Icons";

export function ManagerTopNav({
  activeTab,
  onTabChange,
  currentUser,
  pendingCount = 0,
  onLogout,
}) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: DashboardIcon },
    { id: "assignments", label: "Giao bài", icon: ClipboardIcon },
    { id: "performance", label: "Năng lực", icon: TrophyIcon },
    { id: "reports", label: "Reports", icon: CheckCircleIcon, badge: pendingCount > 0 ? `${pendingCount}` : null, highlightBadge: pendingCount > 0 },
  ];

  const initials = currentUser?.display_name
    ? currentUser.display_name.split(" ").slice(-1)[0].substring(0, 2).toUpperCase()
    : "QL";

  return (
    <header className="manager-topnav">
      <div className="manager-topnav-inner">
        {/* Left: Brand Logo & Title */}
        <div
          className="manager-topnav-brand"
          onClick={() => onTabChange("dashboard")}
          role="button"
          tabIndex={0}
        >
          <div className="manager-brand-logo-badge">
            <VinFastLogo style={{ width: 24, height: 24 }} />
          </div>
          <div className="manager-brand-info">
            <div className="manager-brand-title">AI Sales Coach</div>
            <div className="manager-brand-subtitle">VinFast Vinh, Nghệ An</div>
          </div>
        </div>

        {/* Center: Horizontal Navigation Pill Tabs matching Image 4 & 5 */}
        <nav className="manager-nav-pills" aria-label="Manager Navigation">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`manager-nav-pill-item ${isActive ? "active" : ""}`}
                onClick={() => onTabChange(item.id)}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon style={{ width: 15, height: 15 }} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`pill-badge ${item.highlightBadge ? "highlight" : ""}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Workspace switcher & Actions */}
        <div className="manager-topnav-actions">
          {/* User Profile */}
          <div className="manager-user-badge">
            <span className="manager-user-avatar">{initials}</span>
            <div className="manager-user-details">
              <span className="manager-user-name">{currentUser?.display_name || "Manager"}</span>
              <span className="manager-user-role">Manager</span>
            </div>
          </div>

          {/* Logout Button */}
          <button
            type="button"
            className="manager-logout-btn"
            onClick={onLogout}
            title="Đăng xuất khỏi hệ thống"
          >
            <LogoutIcon style={{ width: 15, height: 15 }} />
            <span className="logout-text">Đăng xuất</span>
          </button>
        </div>
      </div>

      {/* Mobile/Tablet Horizontal Scroll Sub-bar */}
      <div className="manager-mobile-subnav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`manager-mobile-pill ${isActive ? "active" : ""}`}
              onClick={() => onTabChange(item.id)}
            >
              <Icon style={{ width: 14, height: 14 }} />
              <span>{item.label}</span>
              {item.badge && (
                <span className={`pill-badge ${item.highlightBadge ? "highlight" : ""}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
}
