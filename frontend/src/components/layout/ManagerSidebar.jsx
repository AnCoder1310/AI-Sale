import {
  VinFastLogo,
  DashboardIcon,
  UsersIcon,
  ClipboardIcon,
  HistoryIcon,
  CheckCircleIcon,
  LogoutIcon,
} from "../common/Icons";

export function ManagerSidebar({
  activeTab,
  onTabChange,
  currentUser,
  pendingCount = 0,
  activeAdvisorsCount = 0,
  assignmentsCount = 0,
  onLogout,
}) {
  const menuItems = [
    { id: "dashboard", label: "Tổng quan", icon: DashboardIcon, badge: "KPI" },
    { id: "team", label: "Đội ngũ tư vấn", icon: UsersIcon, badge: activeAdvisorsCount > 0 ? String(activeAdvisorsCount) : null },
    { id: "assignments", label: "Giao bài tập", icon: ClipboardIcon, badge: assignmentsCount > 0 ? String(assignmentsCount) : null },
    { id: "reviews", label: "Thẩm định HITL", icon: CheckCircleIcon, badge: pendingCount > 0 ? `${pendingCount} Chờ` : null, highlightBadge: pendingCount > 0 },
    { id: "history", label: "Lịch sử luyện tập", icon: HistoryIcon, badge: null },
  ];

  const initials = currentUser?.display_name
    ? currentUser.display_name.split(" ").slice(-1)[0].substring(0, 2).toUpperCase()
    : "QL";

  return (
    <aside className="manager-sidebar">
      <div>
        {/* Brand Header */}
        <div className="manager-sidebar-brand">
          <div className="manager-sidebar-logo">
            <VinFastLogo style={{ width: 22, height: 22 }} />
          </div>
          <div className="manager-sidebar-brand-text">
            <div className="brand-title">VINFAST Manager</div>
            <div className="brand-subtitle">VinFast Vinh, Nghệ An</div>
          </div>
        </div>

        {/* Portal Status Tag */}
        <div className="manager-sidebar-tag-wrap">
          <div className="manager-sidebar-tag">
            <span className="live-dot" />
            <span>Management Portal</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="manager-sidebar-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`manager-nav-item ${isActive ? "active" : ""}`}
              >
                <div className="nav-item-left">
                  <Icon className="nav-icon" style={{ width: 16, height: 16 }} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`nav-badge ${item.highlightBadge ? "highlight" : ""}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile & Logout */}
      <div className="manager-sidebar-footer">
        <div className="manager-user-info">
          <div className="manager-user-avatar">{initials}</div>
          <div className="manager-user-details">
            <div className="manager-user-name">{currentUser?.display_name || "Quản lý"}</div>
            <div className="manager-user-role">Quản lý Đào tạo</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          title="Đăng xuất"
          className="manager-logout-btn"
        >
          <LogoutIcon style={{ width: 16, height: 16 }} />
        </button>
      </div>
    </aside>
  );
}
