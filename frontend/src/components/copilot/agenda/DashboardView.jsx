import { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Award,
  BatteryCharging,
  CalendarDays,
  Car,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  Flame,
  MapPin,
  MessageSquare,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
  Wallet,
} from 'lucide-react';
import { salesCopilotApi } from '../../../api/salesCopilotApi';
import { leadStages } from '../customerWorkspace/workspaceData';
import { useAgendaResource } from './agendaResource';
import { filters, formatDateTime, itemLabel, taskState, waitingDuration } from './agendaData';
import { useWorkspaceClock } from '../customerWorkspace/useCustomerWorkspace';

const STAGE_META = {
  new: { label: 'Mới liên hệ', tone: 'slate' },
  discovery: { label: 'Tìm hiểu nhu cầu', tone: 'blue' },
  qualified: { label: 'Đang tư vấn', tone: 'indigo' },
  considering: { label: 'Đang cân nhắc', tone: 'amber' },
  negotiating: { label: 'Đang đàm phán', tone: 'purple' },
  deposit_process: { label: 'Chuẩn bị đặt cọc', tone: 'emerald' },
  won: { label: 'Đã ký hợp đồng', tone: 'green' },
  lost: { label: 'Ngừng chăm sóc', tone: 'gray' },
  needs_confirmation: { label: 'Cần xác nhận giai đoạn', tone: 'amber' },
};

function getStageMeta(stageId) {
  if (STAGE_META[stageId]) return STAGE_META[stageId];
  const found = leadStages.find((s) => s.id === stageId);
  return { label: found?.label || stageId || 'Chưa phân loại', tone: 'slate' };
}

function formatCompactMoney(vnd) {
  if (!vnd || !Number.isFinite(Number(vnd)) || Number(vnd) <= 0) return 'Chưa rõ ngân sách';
  const num = Number(vnd);
  if (num >= 1_000_000_000) {
    const billions = (num / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '');
    return `${billions.replace('.', ',')} tỷ ₫`;
  }
  const millions = Math.round(num / 1_000_000);
  return `${millions.toLocaleString('vi-VN')} tr ₫`;
}

function cleanDemoLabel(text) {
  if (!text) return '';
  return String(text).replace(/^\[Mẫu\]\s*/i, '').trim();
}

function getGreeting(nowMs) {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', hour: 'numeric', hour12: false }).format(new Date(nowMs))
  );
  if (hour < 12) return 'Chào buổi sáng';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

function Empty({ children = 'Chưa có dữ liệu.' }) {
  return <p className="agenda-empty">{children}</p>;
}

function Panel({ title, subtitle, icon: Icon, children, action, className = '' }) {
  return (
    <section className={`agenda-panel ${className}`}>
      <div className="agenda-panel-title">
        <div className="agenda-panel-heading-group">
          {Icon && (
            <span className="agenda-panel-icon">
              <Icon size={16} />
            </span>
          )}
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="agenda-panel-subtitle">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="agenda-panel-action">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function TaskRow({ item, now, onEdit, onCustomer, onStatus, busy }) {
  const stateLabel = taskState(item, now);
  const isLive = stateLabel === 'Đang diễn ra';
  const isOverdue = stateLabel === 'Cần cập nhật trạng thái';
  const isHigh = ['high', 'urgent'].includes(item.priority);

  return (
    <div className={`agenda-task-row ${isLive ? 'is-live' : ''} ${isOverdue ? 'is-overdue' : ''}`}>
      <div className="agenda-task-copy">
        <div className="agenda-task-heading">
          <span className={`agenda-kind ${item.item_type}`}>{itemLabel(item)}</span>
          <span className={`agenda-priority ${isHigh ? 'is-high' : item.priority === 'low' ? 'is-low' : ''}`}>
            {isHigh ? '🔥 Ưu tiên cao' : item.priority === 'low' ? 'Ưu tiên thấp' : 'Ưu tiên TB'}
          </span>
          <span
            className={`agenda-state-pill ${
              isLive
                ? 'tone-live'
                : isOverdue
                  ? 'tone-danger'
                  : item.status === 'needs_review'
                    ? 'tone-purple'
                    : item.status === 'completed'
                      ? 'tone-success'
                      : 'tone-neutral'
            }`}
          >
            {stateLabel}
          </span>
        </div>

        <strong className="agenda-task-title">{item.title}</strong>

        <div className="agenda-task-details">
          <span className="agenda-task-time">
            <Clock3 size={13} />
            {item.starts_at ? `${formatDateTime(item.starts_at)} – ${formatDateTime(item.ends_at)}` : 'Cần xếp khung giờ'}
          </span>
          {item.location && (
            <span className="agenda-task-location">
              <MapPin size={13} />
              {item.location}
            </span>
          )}
          <span className="agenda-task-customer">
            {item.customer_name ? (
              <button type="button" className="sw-text-button agenda-customer-chip" onClick={() => onCustomer(item)}>
                👤 {item.customer_name}
              </button>
            ) : (
              <span className="agenda-personal-tag">Cá nhân</span>
            )}
          </span>
        </div>
      </div>

      <div className="agenda-task-actions">
        {!['completed', 'needs_review'].includes(item.status) && (
          <button
            type="button"
            className="agenda-btn-action is-complete"
            disabled={busy}
            onClick={() => onStatus(item, 'completed')}
          >
            <Check size={13} />
            Hoàn thành
          </button>
        )}
        <button type="button" className="agenda-btn-action" disabled={busy} onClick={() => onEdit(item)}>
          {item.status === 'needs_review' ? '✨ Duyệt / xếp lịch' : 'Sửa'}
        </button>
        {item.status === 'completed' && (
          <button type="button" className="agenda-btn-action" disabled={busy} onClick={() => onStatus(item, 'pending')}>
            Mở lại
          </button>
        )}
        <button
          type="button"
          className="agenda-btn-action is-cancel"
          disabled={busy}
          onClick={() => onStatus(item, 'cancelled')}
        >
          Hủy
        </button>
      </div>
    </div>
  );
}

function Bars({ rows, label, totalCount }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  const sum = totalCount || rows.reduce((acc, r) => acc + r.count, 0) || 1;
  return rows.length ? (
    <div className="agenda-bars">
      {rows.map((row) => {
        const pct = Math.round((row.count / sum) * 100);
        return (
          <div className="agenda-bar-row" key={row.key}>
            <div className="agenda-bar-header">
              <span className="agenda-bar-label">
                {row.tone && <i className={`agenda-dot tone-${row.tone}`} />}
                {label(row)}
              </span>
              <span className="agenda-bar-value">
                <strong>{row.count}</strong>
                <small>({pct}%)</small>
              </span>
            </div>
            <div className="agenda-bar-track">
              <span
                className={row.tone ? `tone-${row.tone}` : ''}
                style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  ) : (
    <Empty />
  );
}

export function DashboardView({
  currentUser,
  active,
  onCreate,
  onEdit,
  onCustomer,
  onCalendar,
  focusedTask,
  onClearFocus,
}) {
  const [filter, setFilter] = useState('today');
  const [page, setPage] = useState(1);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState('');
  const [showAllWaiting, setShowAllWaiting] = useState(false);
  const now = useWorkspaceClock();

  const resource = useAgendaResource(
    currentUser.user_id,
    `dashboard:${days}:${filter}:${page}`,
    () => salesCopilotApi.getDashboard({ activity_days: days, work_filter: filter, work_page: page }),
    active
  );
  const data = resource.data;

  function changeFilter(value) {
    setFilter(value);
    setPage(1);
  }

  async function status(item, value) {
    if (busy) return;
    setBusy(item.id);
    setActionError('');
    try {
      await salesCopilotApi.updateTaskStatus(item.id, value);
      if (focusedTask?.id === item.id) onClearFocus();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusy(null);
    }
  }

  const row = (item) => (
    <TaskRow
      key={item.id}
      item={item}
      now={now}
      busy={busy === item.id}
      onEdit={onEdit}
      onCustomer={onCustomer}
      onStatus={status}
    />
  );

  const activityMax = Math.max(1, ...(data?.message_activity || []).map((day) => day.customer + day.sales));
  const totalCustomerMsgs = (data?.message_activity || []).reduce((acc, d) => acc + d.customer, 0);
  const totalSalesMsgs = (data?.message_activity || []).reduce((acc, d) => acc + d.sales, 0);
  const workCounts = data?.portfolio_insights?.work_counts || {};
  const completeness = data?.portfolio_insights?.profile_completeness || {};
  const activeTotal = Math.max(1, completeness.total_active || data?.kpis?.active_customers || 1);

  return (
    <div className="agenda-page dashboard-page" aria-label="Dashboard cá nhân">
      {/* HERO COMMAND HEADER */}
      <header className="agenda-hero-banner">
        <div className="agenda-hero-copy">
          <div className="agenda-eyebrow-row">
            <span className="agenda-eyebrow-pill">
              <Sparkles size={12} /> TRUNG TÂM ĐIỀU HÀNH TƯ VẤN VIÊN AI
            </span>
            {data && (
              <span className="agenda-updated" role="status">
                {resource.loading ? 'Đang đồng bộ… · ' : ''}Cập nhật {formatDateTime(data.generated_at)} · Giờ VN
              </span>
            )}
          </div>
          <h1>
            {getGreeting(now)}, {currentUser?.display_name || 'Tư vấn viên'}!
          </h1>
          {data ? (
            <p className="agenda-hero-summary">
              Bạn đang phụ trách <strong>{data.kpis.active_customers} khách hàng mở</strong>
              {data.kpis.hot_leads > 0 ? (
                <>
                  {' '}
                  (trong đó có <strong>{data.kpis.hot_leads} cơ hội nóng</strong> cần thúc đẩy chốt)
                </>
              ) : null}
              {data.kpis.pipeline_budget_vnd > 0 ? (
                <>
                  , tổng ngân sách dự kiến khoảng <strong>{formatCompactMoney(data.kpis.pipeline_budget_vnd)}</strong>
                </>
              ) : null}
              .{' '}
              {data.kpis.waiting_customers > 0 ? (
                <>
                  Hiện có <strong>{data.kpis.waiting_customers} khách đang chờ bạn phản hồi</strong>.
                </>
              ) : (
                <>Tất cả tin nhắn của khách hàng đều đã được phản hồi.</>
              )}
            </p>
          ) : (
            <p className="agenda-hero-summary">
              Theo dõi tiến độ tư vấn, lịch hẹn lái thử, câu hỏi bỏ ngỏ và gợi ý chăm sóc khách hàng từ AI.
            </p>
          )}
        </div>

        <div className="agenda-heading-actions">
          <button
            type="button"
            className="sw-secondary-button"
            aria-label="Làm mới Dashboard"
            title="Làm mới dữ liệu"
            disabled={resource.loading}
            onClick={resource.reload}
          >
            <RefreshCw size={15} />
          </button>
          <button type="button" className="sw-secondary-button" onClick={() => onCalendar()}>
            <CalendarDays size={15} />
            Lịch tuần
          </button>
          <button
            type="button"
            className="sw-primary-button"
            disabled={!data}
            onClick={() => onCreate(data.customers)}
          >
            <Plus size={16} />
            Tạo công việc / lịch hẹn
          </button>
        </div>
      </header>

      {(resource.error || actionError) && (
        <div className="sw-error-banner" role="alert">
          {resource.error || actionError}
          <button type="button" className="sw-text-button" onClick={resource.reload}>
            Thử lại
          </button>
        </div>
      )}

      {!data && (
        <p className="agenda-empty" role="status">
          {resource.loading ? 'Đang tải dữ liệu Dashboard…' : 'Chưa tải được dữ liệu.'}
        </p>
      )}

      {data && (
        <>
          {/* QUICK ACTION RADAR ALERTS */}
          {(data.kpis.waiting_customers > 0 ||
            data.kpis.unanalyzed_customers > 0 ||
            data.kpis.stale_tasks > 0 ||
            data.kpis.review_tasks > 0 ||
            data.unscheduled.total > 0) && (
            <div className="agenda-action-radar" role="region" aria-label="Ưu tiên xử lý ngay">
              <span className="agenda-radar-label">⚡ Cần chú ý ngay:</span>
              <div className="agenda-radar-chips">
                {data.kpis.waiting_customers > 0 && (
                  <button
                    type="button"
                    className="agenda-radar-chip is-urgent"
                    onClick={() => document.getElementById('agenda-waiting')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    <MessageSquare size={13} />
                    <strong>{data.kpis.waiting_customers} khách</strong> đang chờ phản hồi
                  </button>
                )}
                {data.kpis.unanalyzed_customers > 0 && (
                  <button
                    type="button"
                    className="agenda-radar-chip is-ai"
                    onClick={() =>
                      document.getElementById('agenda-priority-leads')?.scrollIntoView({ behavior: 'smooth' })
                    }
                  >
                    <Sparkles size={13} />
                    <strong>{data.kpis.unanalyzed_customers} hội thoại</strong> có tin mới chưa phân tích AI
                  </button>
                )}
                {data.kpis.stale_tasks > 0 && (
                  <button
                    type="button"
                    className="agenda-radar-chip is-warning"
                    onClick={() => {
                      changeFilter('stale');
                      document.getElementById('agenda-work-panel')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <AlertCircle size={13} />
                    <strong>{data.kpis.stale_tasks} mục</strong> đã qua giờ cần cập nhật
                  </button>
                )}
                {data.kpis.review_tasks > 0 && (
                  <button
                    type="button"
                    className="agenda-radar-chip is-review"
                    onClick={() => {
                      changeFilter('review');
                      document.getElementById('agenda-work-panel')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <CheckCircle2 size={13} />
                    <strong>{data.kpis.review_tasks} đề xuất AI</strong> chờ duyệt lịch
                  </button>
                )}
                {data.unscheduled.total > 0 && (
                  <button
                    type="button"
                    className="agenda-radar-chip is-neutral"
                    onClick={() => {
                      changeFilter('unscheduled');
                      document.getElementById('agenda-work-panel')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <Clock3 size={13} />
                    <strong>{data.unscheduled.total} việc</strong> chưa xếp giờ
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 6 KPI CARDS */}
          <div className="agenda-kpis">
            <button
              type="button"
              className="agenda-kpi tone-blue"
              onClick={() => document.getElementById('agenda-stages')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <div className="agenda-kpi-top">
                <span className="agenda-kpi-icon">
                  <UsersRound size={18} />
                </span>
                <span className="agenda-kpi-badge">
                  🔥 {data.kpis.hot_leads || 0} cơ hội nóng
                </span>
              </div>
              <strong>{data.kpis.active_customers}</strong>
              <span className="agenda-kpi-label">Khách đang chăm sóc</span>
              <small>
                <span>Điểm tiềm năng TB: {data.kpis.avg_lead_score || 0}/100</span>
                <ArrowRight size={12} />
              </small>
            </button>

            <button
              type="button"
              className={`agenda-kpi ${data.kpis.waiting_customers > 0 ? 'tone-amber' : 'tone-emerald'}`}
              onClick={() => document.getElementById('agenda-waiting')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <div className="agenda-kpi-top">
                <span className="agenda-kpi-icon">
                  <MessageSquare size={18} />
                </span>
                <span className="agenda-kpi-badge">
                  {data.kpis.waiting_customers > 0 ? 'Cần trả lời ngay' : 'Đã phản hồi hết'}
                </span>
              </div>
              <strong>{data.kpis.waiting_customers}</strong>
              <span className="agenda-kpi-label">Khách chờ phản hồi</span>
              <small>
                <span>
                  {data.waiting_customers[0]?.waiting_since
                    ? `Lâu nhất: ${waitingDuration(data.waiting_customers[0].waiting_since, now)}`
                    : 'Không có tin nhắn tồn đọng'}
                </span>
                <ArrowRight size={12} />
              </small>
            </button>

            <button
              type="button"
              className="agenda-kpi tone-indigo"
              onClick={() => {
                changeFilter('today');
                document.getElementById('agenda-work-panel')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <div className="agenda-kpi-top">
                <span className="agenda-kpi-icon">
                  <CalendarDays size={18} />
                </span>
                <span className="agenda-kpi-badge">
                  {data.kpis.active_appointments || 0} lịch hẹn mở
                </span>
              </div>
              <strong>{data.kpis.today_events}</strong>
              <span className="agenda-kpi-label">Lịch hôm nay</span>
              <small>
                <span>{data.kpis.high_priority_tasks || 0} nhiệm vụ ưu tiên cao</span>
                <ArrowRight size={12} />
              </small>
            </button>

            <button
              type="button"
              className="agenda-kpi tone-purple"
              onClick={() => {
                changeFilter('upcoming');
                document.getElementById('agenda-work-panel')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <div className="agenda-kpi-top">
                <span className="agenda-kpi-icon">
                  <Clock3 size={18} />
                </span>
                <span className="agenda-kpi-badge">
                  {data.unscheduled.total} chưa xếp giờ
                </span>
              </div>
              <strong>{data.kpis.upcoming_events}</strong>
              <span className="agenda-kpi-label">Sắp đến trong 7 ngày</span>
              <small>
                <span>{data.kpis.review_tasks || 0} đề xuất chờ duyệt</span>
                <ArrowRight size={12} />
              </small>
            </button>

            <button
              type="button"
              className="agenda-kpi tone-teal"
              onClick={() => document.getElementById('agenda-portfolio')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <div className="agenda-kpi-top">
                <span className="agenda-kpi-icon">
                  <Wallet size={18} />
                </span>
                <span className="agenda-kpi-badge">
                  {completeness.with_budget || 0}/{completeness.total_active || data.kpis.active_customers} rõ ngân sách
                </span>
              </div>
              <strong className="agenda-kpi-money">
                {data.kpis.pipeline_budget_vnd > 0 ? formatCompactMoney(data.kpis.pipeline_budget_vnd) : '0 ₫'}
              </strong>
              <span className="agenda-kpi-label">Quy mô ngân sách Pipeline</span>
              <small>
                <span>Xem chân dung tài chính khách</span>
                <ArrowRight size={12} />
              </small>
            </button>

            <button
              type="button"
              className="agenda-kpi tone-emerald"
              onClick={() => {
                changeFilter('completed');
                document.getElementById('agenda-work-panel')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <div className="agenda-kpi-top">
                <span className="agenda-kpi-icon">
                  <Award size={18} />
                </span>
                <span className="agenda-kpi-badge">
                  {data.milestones.length} cột mốc
                </span>
              </div>
              <strong>
                {data.kpis.completed_tasks || 0}
                <span className="agenda-kpi-denom">/{data.kpis.total_tasks}</span>
              </strong>
              <span className="agenda-kpi-label">Công việc hoàn thành</span>
              <small>
                <span>
                  {data.kpis.stale_tasks > 0
                    ? `${data.kpis.stale_tasks} mục cần cập nhật trạng thái`
                    : 'Tiến độ công việc ổn định'}
                </span>
                <ArrowRight size={12} />
              </small>
            </button>
          </div>

          {focusedTask && (
            <Panel
              title="Công việc đang chọn từ Lịch biểu"
              icon={Target}
              action={
                <button type="button" className="sw-text-button" onClick={onClearFocus}>
                  Đóng
                </button>
              }
            >
              {row(focusedTask)}
            </Panel>
          )}

          {/* MAIN 2-COLUMN OPERATIONAL WORKSPACE */}
          <div className="agenda-main-grid">
            {/* LEFT COLUMN: TASKS & WAITING CUSTOMERS */}
            <div className="agenda-column">
              <div id="agenda-work-panel">
                <Panel
                  title={filter === 'today' ? 'Việc hôm nay' : filters[filter]}
                  subtitle="Quản lý lịch hẹn lái thử, cuộc gọi chăm sóc và đề xuất từ AI"
                  icon={CalendarDays}
                  action={<span className="agenda-count">{data.work_items.total} mục</span>}
                >
                  <div className="agenda-filter-tabs" aria-label="Lọc công việc">
                    {Object.entries(filters).map(([value, label]) => {
                      const tabCount = workCounts[value];
                      return (
                        <button
                          type="button"
                          key={value}
                          className={filter === value ? 'is-active' : ''}
                          aria-pressed={filter === value}
                          onClick={() => changeFilter(value)}
                        >
                          <span>{label}</span>
                          {typeof tabCount === 'number' && (
                            <em className={`agenda-tab-badge ${value === 'stale' && tabCount > 0 ? 'is-alert' : ''}`}>
                              {tabCount}
                            </em>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {data.work_items.items.length ? (
                    <div className="agenda-task-list">{data.work_items.items.map(row)}</div>
                  ) : (
                    <Empty>
                      {filter === 'today'
                        ? 'Hôm nay chưa có công việc hoặc lịch hẹn được xếp giờ.'
                        : 'Không có mục trong nhóm này.'}
                    </Empty>
                  )}

                  {data.work_items.total > 10 && (
                    <div className="agenda-pagination">
                      <button
                        type="button"
                        className="sw-secondary-button"
                        aria-label="Trang trước"
                        disabled={data.work_items.page <= 1 || resource.loading}
                        onClick={() => setPage(data.work_items.page - 1)}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span>
                        Trang {data.work_items.page}/{Math.ceil(data.work_items.total / 10)}
                      </span>
                      <button
                        type="button"
                        className="sw-secondary-button"
                        aria-label="Trang sau"
                        disabled={data.work_items.page * 10 >= data.work_items.total || resource.loading}
                        onClick={() => setPage(data.work_items.page + 1)}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </Panel>
              </div>

              <div id="agenda-waiting">
                <Panel
                  title="Khách cần phản hồi"
                  subtitle="Khách hàng nhắn tin cuối cùng và đang đợi tư vấn viên trả lời"
                  icon={MessageSquare}
                  action={<span className="agenda-count is-amber">{data.waiting_customers.length} khách</span>}
                >
                  {data.waiting_customers.length ? (
                    <div className="agenda-waiting-list">
                      {(showAllWaiting ? data.waiting_customers : data.waiting_customers.slice(0, 5)).map(
                        (customer) => {
                          const stageInfo = getStageMeta(customer.stage);
                          const preview = cleanDemoLabel(customer.last_message);
                          const cleanName = cleanDemoLabel(customer.customer_name) || customer.customer_name;
                          const initial = cleanName.split(/\s+/).filter(Boolean).at(-1)?.charAt(0) || 'K';
                          return (
                            <div className="agenda-waiting-card" key={customer.customer_id}>
                              <div className="agenda-waiting-card-top">
                                <div className="agenda-waiting-identity">
                                  <span className="agenda-avatar">{initial}</span>
                                  <div>
                                    <div className="agenda-waiting-name-row">
                                      <strong>{customer.customer_name}</strong>
                                      <span className={`agenda-stage-pill tone-${stageInfo.tone}`}>
                                        {stageInfo.label}
                                      </span>
                                      {customer.models?.length > 0 && (
                                        <span className="agenda-model-pill">
                                          <Car size={11} /> {customer.models.join(', ')}
                                        </span>
                                      )}
                                      {customer.budget_vnd > 0 && (
                                        <span className="agenda-budget-pill">
                                          {formatCompactMoney(customer.budget_vnd)}
                                        </span>
                                      )}
                                    </div>
                                    <div className="agenda-waiting-submeta">
                                      <span
                                        className="agenda-wait-time"
                                        title={formatDateTime(customer.waiting_since)}
                                      >
                                        ⏳ {waitingDuration(customer.waiting_since, now)}
                                      </span>
                                      {customer.location && <span>📍 {customer.location}</span>}
                                      {customer.unanalyzed_count > 0 && (
                                        <span className="agenda-unanalyzed-tag">
                                          ✨ {customer.unanalyzed_count} tin chưa phân tích
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="agenda-waiting-actions">
                                  <button
                                    type="button"
                                    className="agenda-btn-primary-sm"
                                    onClick={() => onCustomer(customer)}
                                  >
                                    💬 Phản hồi ngay
                                  </button>
                                  <button
                                    type="button"
                                    className="agenda-btn-ghost-sm"
                                    onClick={() => onCustomer({ ...customer, tool: 'summary' })}
                                  >
                                    Hồ sơ AI
                                  </button>
                                </div>
                              </div>

                              {preview && (
                                <button
                                  type="button"
                                  className="agenda-waiting-preview"
                                  onClick={() => onCustomer(customer)}
                                >
                                  <span>“{preview}”</span>
                                  <ChevronRight size={14} />
                                </button>
                              )}
                            </div>
                          );
                        }
                      )}
                      {data.waiting_customers.length > 5 && (
                        <button
                          type="button"
                          className="agenda-expand-btn"
                          onClick={() => setShowAllWaiting((prev) => !prev)}
                        >
                          {showAllWaiting
                            ? 'Thu gọn danh sách chờ'
                            : `Xem tất cả ${data.waiting_customers.length} khách đang chờ phản hồi (+${data.waiting_customers.length - 5})`}
                        </button>
                      )}
                    </div>
                  ) : (
                    <Empty>Chưa có khách đang chờ phản hồi trong hội thoại đã lưu.</Empty>
                  )}
                </Panel>
              </div>
            </div>

            {/* RIGHT COLUMN: UPCOMING TIMELINE, HOT LEADS, UNSCHEDULED & MILESTONES */}
            <div className="agenda-column">
              <Panel
                title="Sự kiện sắp đến"
                subtitle="5 lịch hẹn và công việc kế tiếp trên lịch biểu"
                icon={Clock3}
                action={
                  <button type="button" className="sw-text-button" onClick={() => onCalendar()}>
                    Xem lịch <ArrowRight size={13} />
                  </button>
                }
              >
                {data.upcoming_events.length ? (
                  <div className="agenda-timeline-list">
                    {data.upcoming_events.map((item) => (
                      <button
                        type="button"
                        className="agenda-upcoming"
                        key={item.id}
                        onClick={() => onCalendar(item.starts_at)}
                      >
                        <span className={`agenda-event-dot ${item.item_type}`} />
                        <span className="agenda-upcoming-body">
                          <strong>{item.title}</strong>
                          <small className="agenda-upcoming-time">
                            <Clock3 size={11} /> {formatDateTime(item.starts_at)} – {formatDateTime(item.ends_at)}
                            {item.location ? ` · 📍 ${item.location}` : ''}
                          </small>
                          <small>
                            {item.customer_name || 'Cá nhân'} · {itemLabel(item)}
                            {['high', 'urgent'].includes(item.priority) ? ' · 🔥 Ưu tiên cao' : ''}
                          </small>
                        </span>
                        <ChevronRight size={14} className="agenda-upcoming-chevron" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <Empty>Chưa có sự kiện sắp đến.</Empty>
                )}
              </Panel>

              <div id="agenda-priority-leads">
                <Panel
                  title="Cơ hội bán hàng trọng điểm"
                  subtitle="Khách hàng tiềm năng cao theo giai đoạn, điểm Lead & ngân sách"
                  icon={Flame}
                  action={<span className="agenda-count">{(data.priority_customers || []).length} khách</span>}
                >
                  {(data.priority_customers || []).length ? (
                    <div className="agenda-priority-list">
                      {data.priority_customers.map((lead) => {
                        const stageInfo = getStageMeta(lead.stage);
                        return (
                          <div className="agenda-priority-card" key={lead.customer_id}>
                            <div className="agenda-priority-header">
                              <button
                                type="button"
                                className="agenda-priority-name"
                                onClick={() => onCustomer(lead)}
                              >
                                <strong>{lead.customer_name}</strong>
                                <span className={`agenda-stage-pill tone-${stageInfo.tone}`}>{stageInfo.label}</span>
                              </button>
                              {lead.score > 0 && (
                                <span
                                  className={`agenda-score-badge ${
                                    lead.score >= 75 ? 'is-hot' : lead.score >= 50 ? 'is-warm' : ''
                                  }`}
                                  title="Điểm tiềm năng khách hàng"
                                >
                                  Điểm {lead.score}
                                </span>
                              )}
                            </div>

                            <div className="agenda-priority-tags">
                              {lead.models?.length > 0 && (
                                <span className="agenda-mini-tag">🚘 {lead.models.join(', ')}</span>
                              )}
                              {lead.budget_vnd > 0 && (
                                <span className="agenda-mini-tag">💰 {formatCompactMoney(lead.budget_vnd)}</span>
                              )}
                              {lead.payment_method && (
                                <span className="agenda-mini-tag">
                                  💳{' '}
                                  {lead.payment_method === 'installment'
                                    ? 'Trả góp'
                                    : lead.payment_method === 'cash'
                                      ? 'Trả thẳng'
                                      : lead.payment_method}
                                </span>
                              )}
                              {lead.purchase_timeline && (
                                <span className="agenda-mini-tag">🗓️ {lead.purchase_timeline}</span>
                              )}
                            </div>

                            <div className="agenda-priority-footer">
                              <div className="agenda-priority-flags">
                                {lead.is_waiting && <span className="agenda-flag is-waiting">Đang chờ trả lời</span>}
                                {lead.unanalyzed_count > 0 && (
                                  <span className="agenda-flag is-ai">
                                    {lead.unanalyzed_count} tin mới chưa phân tích
                                  </span>
                                )}
                                {lead.issues_count > 0 && (
                                  <span className="agenda-flag is-issue">{lead.issues_count} băn khoăn</span>
                                )}
                              </div>
                              <div className="agenda-priority-links">
                                <button
                                  type="button"
                                  className="sw-text-button"
                                  onClick={() => onCustomer({ ...lead, tool: 'summary' })}
                                >
                                  Hồ sơ AI
                                </button>
                                <button type="button" className="sw-text-button" onClick={() => onCustomer(lead)}>
                                  Mở Chat <ArrowRight size={11} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <Empty>Chưa có dữ liệu khách hàng trọng điểm.</Empty>
                  )}
                </Panel>
              </div>

              <Panel
                title="Công việc cần xếp lịch"
                subtitle="Các đầu việc chưa gắn khung giờ cụ thể"
                icon={Target}
                action={
                  <button type="button" className="sw-text-button" onClick={() => changeFilter('unscheduled')}>
                    {data.unscheduled.total} mục <ChevronRight size={13} />
                  </button>
                }
              >
                {data.unscheduled.items.length ? (
                  <div className="agenda-timeline-list">
                    {data.unscheduled.items.map((item) => (
                      <button
                        type="button"
                        className="agenda-upcoming"
                        key={item.id}
                        onClick={() => onEdit(item)}
                      >
                        <Clock3 size={16} className="agenda-unscheduled-icon" />
                        <span className="agenda-upcoming-body">
                          <strong>{item.title}</strong>
                          <small>{item.customer_name || 'Cá nhân'} · Bấm để bổ sung khoảng giờ</small>
                        </span>
                        <ChevronRight size={14} className="agenda-upcoming-chevron" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <Empty>Không có công việc cần xếp lịch.</Empty>
                )}
              </Panel>

              {data.milestones?.length > 0 && (
                <Panel
                  title="Cột mốc bán hàng đã xác nhận"
                  subtitle="Lái thử, báo giá và các hoạt động quan trọng đã hoàn tất"
                  icon={Award}
                  action={<span className="agenda-count">{data.milestones.length} cột mốc</span>}
                >
                  <div className="agenda-milestone-list">
                    {data.milestones.slice(-5).reverse().map((ms) => (
                      <div className="agenda-milestone-item" key={ms.id}>
                        <span className="agenda-milestone-badge">✓</span>
                        <div className="agenda-milestone-copy">
                          <strong>{ms.action || ms.event_type}</strong>
                          <small>
                            {ms.customer_name ? (
                              <button
                                type="button"
                                className="sw-text-button"
                                onClick={() =>
                                  ms.conversation_id &&
                                  onCustomer({ conversation_id: ms.conversation_id, tool: 'summary' })
                                }
                              >
                                {ms.customer_name}
                              </button>
                            ) : (
                              'Khách hàng'
                            )}{' '}
                            · {formatDateTime(ms.created_at)}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
            </div>
          </div>

          {/* CUSTOMER INTELLIGENCE: UNRESOLVED ISSUES & SALES PROMISES */}
          <Panel
            title="Vấn đề khách hàng còn bỏ ngỏ & Cam kết cần theo dõi"
            subtitle="Tổng hợp tự động từ AI phân tích lịch sử trò chuyện để Sales chuẩn bị kịch bản tư vấn"
            icon={Sparkles}
            action={<span className="agenda-count">{data.customer_intelligence.length} khách hàng</span>}
          >
            <div className="agenda-intelligence-grid">
              {data.customer_intelligence.length ? (
                data.customer_intelligence.map((customer) => {
                  const stageInfo = getStageMeta(customer.stage);
                  const summary = cleanDemoLabel(customer.quick_summary);
                  return (
                    <div className="agenda-intelligence" key={customer.customer_id}>
                      <div className="agenda-intelligence-top">
                        <button
                          type="button"
                          className="agenda-intelligence-title"
                          onClick={() => onCustomer({ ...customer, tool: 'summary' })}
                        >
                          <span>{customer.customer_name}</span>
                          <ChevronRight size={15} />
                        </button>
                        <div className="agenda-intelligence-badges">
                          {customer.stage && (
                            <span className={`agenda-stage-pill tone-${stageInfo.tone}`}>{stageInfo.label}</span>
                          )}
                          {customer.models?.length > 0 && (
                            <span className="agenda-model-pill">{customer.models.join(', ')}</span>
                          )}
                          {customer.budget_vnd > 0 && (
                            <span className="agenda-budget-pill">{formatCompactMoney(customer.budget_vnd)}</span>
                          )}
                        </div>
                      </div>

                      {summary && <p className="agenda-intelligence-summary">{summary}</p>}

                      <div className="agenda-intelligence-section">
                        <span className="agenda-intelligence-label">❓ Băn khoăn / Câu hỏi cần giải đáp:</span>
                        <ul>
                          {customer.issues.slice(0, 3).map((issue) => (
                            <li key={issue}>{cleanDemoLabel(issue)}</li>
                          ))}
                        </ul>
                        {customer.issues.length > 3 && <small>+{customer.issues.length - 3} vấn đề khác</small>}
                      </div>

                      {customer.promises?.length > 0 && (
                        <div className="agenda-intelligence-promises">
                          <span className="agenda-intelligence-label">📌 Cam kết của Sales:</span>
                          <ul>
                            {customer.promises.slice(0, 2).map((promise) => (
                              <li key={promise}>{cleanDemoLabel(promise)}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="agenda-intelligence-footer">
                        <small>
                          {customer.analyzed_at
                            ? `Phân tích ${formatDateTime(customer.analyzed_at)}`
                            : 'Chưa rõ thời điểm phân tích'}
                        </small>
                        <div className="agenda-intelligence-actions">
                          <button
                            type="button"
                            className="sw-text-button"
                            onClick={() => onCustomer({ ...customer, tool: 'summary' })}
                          >
                            Mở Hồ sơ AI
                          </button>
                          <button type="button" className="sw-text-button" onClick={() => onCustomer(customer)}>
                            Tư vấn ngay
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <Empty>Chưa có vấn đề bỏ ngỏ được ghi nhận.</Empty>
              )}
            </div>
          </Panel>

          {/* ANALYTICS & PORTFOLIO INSIGHTS */}
          <div className="agenda-chart-grid">
            <div id="agenda-stages">
              <Panel
                title="Khách theo giai đoạn (Pipeline)"
                subtitle="Phân bổ phễu chuyển đổi khách hàng hiện tại"
                icon={TrendingUp}
              >
                <Bars
                  rows={data.stage_distribution.map((item) => {
                    const meta = getStageMeta(item.stage);
                    return { ...item, key: item.stage, tone: meta.tone };
                  })}
                  label={(row) => getStageMeta(row.stage).label}
                />
              </Panel>
            </div>

            <Panel
              title="Dòng xe được quan tâm"
              subtitle="Nhu cầu các mẫu xe VinFast trong danh sách khách đang phụ trách"
              icon={Car}
            >
              <Bars
                rows={data.model_interest.map((item, idx) => ({
                  ...item,
                  key: item.model,
                  tone: ['blue', 'indigo', 'teal', 'purple', 'emerald', 'amber'][idx % 6],
                }))}
                label={(item) => item.model}
              />
              <p className="agenda-chart-note">Một khách có thể quan tâm nhiều dòng xe cùng lúc.</p>
            </Panel>
          </div>

          {/* CUSTOMER PORTFOLIO INSIGHTS: BUDGET, PAYMENT, CHARGING & PROFILE COMPLETENESS */}
          {data.portfolio_insights && (
            <div id="agenda-portfolio" className="agenda-portfolio-grid">
              <Panel
                title="Phân khúc ngân sách & Thanh toán"
                subtitle="Cơ cấu tài chính để chuẩn bị bảng tính trả góp / lăn bánh"
                icon={CreditCard}
              >
                <div className="agenda-split-insights">
                  <div>
                    <h3 className="agenda-subchart-title">Phân khúc ngân sách</h3>
                    <Bars
                      rows={(data.portfolio_insights.budget_segments || []).map((row, i) => ({
                        ...row,
                        tone: ['teal', 'blue', 'purple', 'slate'][i % 4],
                      }))}
                      label={(r) => r.label}
                      totalCount={activeTotal}
                    />
                  </div>
                  <div>
                    <h3 className="agenda-subchart-title">Phương thức thanh toán</h3>
                    <Bars
                      rows={(data.portfolio_insights.payment_breakdown || []).map((row, i) => ({
                        ...row,
                        tone: ['indigo', 'emerald', 'slate'][i % 3],
                      }))}
                      label={(r) => r.label}
                      totalCount={activeTotal}
                    />
                  </div>
                </div>
              </Panel>

              <Panel
                title="Điều kiện sạc & Độ đầy đủ hồ sơ"
                subtitle="Mức độ nắm bắt thông tin cốt lõi của khách đang chăm sóc"
                icon={BatteryCharging}
              >
                <div className="agenda-split-insights">
                  <div>
                    <h3 className="agenda-subchart-title">Hạ tầng sạc của khách</h3>
                    <Bars
                      rows={(data.portfolio_insights.charging_breakdown || []).map((row, i) => ({
                        ...row,
                        tone: ['emerald', 'blue', 'amber'][i % 3],
                      }))}
                      label={(r) => r.label}
                      totalCount={activeTotal}
                    />
                  </div>
                  <div>
                    <h3 className="agenda-subchart-title">Tỷ lệ nắm bắt thông tin khách ({completeness.total_active || 0} khách mở)</h3>
                    <Bars
                      rows={[
                        { key: 'model', label: 'Đã rõ dòng xe quan tâm', count: completeness.with_model || 0, tone: 'blue' },
                        { key: 'budget', label: 'Đã rõ ngân sách dự kiến', count: completeness.with_budget || 0, tone: 'teal' },
                        { key: 'payment', label: 'Đã rõ trả thẳng / trả góp', count: completeness.with_payment || 0, tone: 'indigo' },
                        { key: 'charging', label: 'Đã khảo sát điều kiện sạc', count: completeness.with_charging || 0, tone: 'emerald' },
                        { key: 'timeline', label: 'Đã rõ thời điểm mua xe', count: completeness.with_timeline || 0, tone: 'purple' },
                      ]}
                      label={(r) => r.label}
                      totalCount={activeTotal}
                    />
                  </div>
                </div>
              </Panel>
            </div>
          )}

          {/* MESSAGE ACTIVITY CHART */}
          <Panel
            title="Hoạt động trao đổi"
            subtitle={`Tần suất tương tác giữa Khách hàng và Sales trong ${days} ngày gần nhất`}
            icon={MessageSquare}
            action={
              <select
                aria-label="Khoảng thời gian hoạt động"
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
              >
                <option value={7}>7 ngày</option>
                <option value={30}>30 ngày</option>
              </select>
            }
          >
            <div className="agenda-activity-header-row">
              <div className="agenda-legend">
                <span>
                  <i className="customer" />
                  Khách hàng ({totalCustomerMsgs} tin)
                </span>
                <span>
                  <i className="sales" />
                  Sales ({totalSalesMsgs} tin)
                </span>
              </div>
              <div className="agenda-activity-summary-pills">
                <span>Tổng cộng: <strong>{totalCustomerMsgs + totalSalesMsgs} tin nhắn</strong></span>
                <span>Trung bình: <strong>{Math.round((totalCustomerMsgs + totalSalesMsgs) / days)} tin/ngày</strong></span>
              </div>
            </div>

            <div
              className="agenda-activity-chart"
              role="img"
              aria-label={`Số tin nhắn khách hàng và sales trong ${days} ngày`}
            >
              {data.message_activity.map((day, index) => (
                <div
                  className="agenda-activity-day"
                  key={day.date}
                  title={`${day.date}: Khách ${day.customer}, Sales ${day.sales}`}
                >
                  <span className="agenda-activity-total">{day.customer + day.sales || ''}</span>
                  <div className="agenda-activity-stack">
                    <span className="sales" style={{ height: `${(day.sales / activityMax) * 140}px` }} />
                    <span className="customer" style={{ height: `${(day.customer / activityMax) * 140}px` }} />
                  </div>
                  <small>
                    {days === 7 || index % 5 === 0 || index === days - 1
                      ? day.date.slice(5).split('-').reverse().join('/')
                      : ''}
                  </small>
                </div>
              ))}
            </div>

            <details className="agenda-chart-data">
              <summary>Xem bảng số liệu chi tiết</summary>
              <table>
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Khách hàng</th>
                    <th>Sales</th>
                    <th>Tổng</th>
                  </tr>
                </thead>
                <tbody>
                  {data.message_activity.map((day) => (
                    <tr key={day.date}>
                      <td>{day.date}</td>
                      <td>{day.customer}</td>
                      <td>{day.sales}</td>
                      <td>{day.customer + day.sales}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </Panel>
        </>
      )}
    </div>
  );
}
