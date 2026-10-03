import {
  RoleplayIcon,
  RobotIcon,
  ArrowRight,
} from '../common/Icons';
import { Badge } from '../common/Badge';
import { INITIAL_ACTIVITIES } from '../../data/competencyData';

export function ProgressView({
  advisorProfile,
  rubricCriteria,
  onNavigateToRoleplay,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* ADVISOR PROFILE SUMMARY CARD */}
      <div className="card-dark" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img
              src={advisorProfile.avatar}
              alt={advisorProfile.name}
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)' }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#FFFFFF' }}>
                  {advisorProfile.name}
                </h1>
                <Badge variant="default" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#FFFFFF', border: 'none' }}>
                  {advisorProfile.role}
                </Badge>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#9da2af', marginTop: 2 }}>
                Đại lý {advisorProfile.branch} • {advisorProfile.level}
              </p>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: '#888888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Chỉ số Năng lực Tư vấn Tổng thể
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, justifyContent: 'flex-end', marginTop: 2 }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#FFFFFF' }}>
                {advisorProfile.overall_score}
              </span>
              <span style={{ fontSize: '1rem', color: '#888888' }}>/ 100</span>
            </div>
          </div>
        </div>

        {/* Milestone Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, paddingTop: 16, borderTop: '1px solid rgba(255, 255, 255, 0.12)' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#888888' }}>Phiên thực chiến hoàn thành:</span>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FFFFFF', marginTop: 2 }}>
              {advisorProfile.completed_sessions} phiên
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#888888' }}>Thời lượng luyện tập:</span>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FFFFFF', marginTop: 2 }}>
              {advisorProfile.practice_hours} giờ
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#888888' }}>Truy vấn tài liệu Copilot:</span>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FFFFFF', marginTop: 2 }}>
              {advisorProfile.copilot_queries} lần
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#888888' }}>Xếp hạng đại lý khu vực:</span>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FFFFFF', marginTop: 2 }}>
              Top 5 (Vinh)
            </div>
          </div>
        </div>
      </div>

      {/* 5 RUBRIC COMPETENCIES BREAKDOWN */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111111' }}>
              5 Trụ cột Đánh giá Năng lực (Rubric Framework)
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#737373' }}>
              Được tự động đo lường qua từng phiên đối thoại thực tế với AI Customer Simulator.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {rubricCriteria.map((crit) => (
            <div
              key={crit.id}
              className="card-white"
              style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#111111' }}>
                      {crit.name}
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: '#737373' }}>
                      {crit.vn_name}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111111' }}>
                      {crit.score}%
                    </span>
                    <div style={{ fontSize: '0.72rem', color: '#888888' }}>
                      Mục tiêu: {crit.target}%
                    </div>
                  </div>
                </div>

                <div className="progress-track" style={{ marginBottom: 12 }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${crit.score}%`,
                      backgroundColor: crit.status === 'attention' ? '#555555' : '#111111',
                    }}
                  />
                </div>

                <p style={{ fontSize: '0.82rem', color: '#555555', lineHeight: 1.4 }}>
                  {crit.description}
                </p>
              </div>

              <div style={{ paddingTop: 10, borderTop: '1px solid #F0F0EE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 4,
                    backgroundColor: crit.status === 'attention' ? '#FEFCE8' : '#F0FDF4',
                    color: crit.status === 'attention' ? '#854D0E' : '#166534',
                  }}
                >
                  {crit.status_label}
                </span>

                {crit.status === 'attention' && (
                  <button
                    onClick={onNavigateToRoleplay}
                    style={{ fontSize: '0.78rem', color: '#111111', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <span>Luyện tập ngay</span>
                    <ArrowRight style={{ width: 12, height: 12 }} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RECENT ACTIVITY TIMELINE */}
      <div className="card-white" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ borderBottom: '1px solid #F0F0EE', paddingBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111111' }}>
              Nhật ký Hoạt động Đào tạo (Activity Timeline)
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#737373' }}>
              Lịch sử các phiên mô phỏng và tra cứu kiến thức gần nhất của tư vấn viên.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {INITIAL_ACTIVITIES.map((act) => (
            <div
              key={act.id}
              style={{
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
                padding: '12px 16px',
                borderRadius: 8,
                backgroundColor: '#FBFBFA',
                border: '1px solid #F0F0EE',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: act.type === 'roleplay' ? '#111111' : '#EAEAE7',
                  color: act.type === 'roleplay' ? '#FFFFFF' : '#111111',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {act.type === 'roleplay' ? (
                  <RoleplayIcon style={{ width: 15, height: 15 }} />
                ) : (
                  <RobotIcon style={{ width: 15, height: 15 }} />
                )}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111111' }}>
                    {act.title}
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: '#888888' }}>
                    {act.time}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#555555', marginTop: 2 }}>
                  {act.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
