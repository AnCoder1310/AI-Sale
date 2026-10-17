import "./managerShell.css";
import {
  VinFastLogo,
  DashboardIcon,
  CheckCircleIcon,
  ClipboardIcon,
  UsersIcon,
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
    { id: "dashboard", label: "Tổng quan", icon: DashboardIcon },
    { id: "assignments", label: "Giao bài", icon: ClipboardIcon },
    { id: "reports", label: "Lịch sử luyện tập", icon: CheckCircleIcon, badge: pendingCount > 0 ? `${pendingCount}` : null, highlightBadge: pendingCount > 0 },
    { id: "accounts", label: "Tài khoản", icon: UsersIcon },
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
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onTabChange("dashboard");
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Về trang tổng quan"
        >
          <div className="manager-brand-logo-badge">
            <VinFastLogo style={{ width: 24, height: 24 }} />
          </div>
          <div className="manager-brand-info">
            <div className="manager-brand-title">AI Sales Coach</div>
            <div className="manager-brand-subtitle">Quản lý</div>
          </div>
        </div>

        {/* Center: Horizontal Navigation Pill Tabs matching Image 4 & 5 */}
        <nav className="manager-nav-pills" aria-label="Điều hướng quản lý">
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
              <span className="manager-user-role">Quản lý</span>
            </div>
          </div>

          {/* Logout Button */}
          <button
            type="button"
            className="manager-logout-btn"
            onClick={onLogout}
            aria-label="Đăng xuất"
          >
            <LogoutIcon style={{ width: 15, height: 15 }} />
            <span className="logout-text">Đăng xuất</span>
          </button>
        </div>
      </div>

      {/* Mobile/Tablet Horizontal Scroll Sub-bar */}
      <div className="manager-mobile-subnav" role="group" aria-label="Điều hướng quản lý">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`manager-mobile-pill ${isActive ? "active" : ""}`}
              onClick={() => onTabChange(item.id)}
              aria-current={isActive ? "page" : undefined}
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
