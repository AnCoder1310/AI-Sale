import {
  SparkleIcon,
  RoleplayIcon,
  RobotIcon,
  BookIcon,
  ArrowRight,
  ChevronRight,
  BullseyeIcon,
  ClockIcon,
} from '../common/Icons';
import { Badge } from '../common/Badge';

export function HomeView({
  advisorProfile,
  scenarios,
  rubricCriteria,
  onNavigate,
  onStartScenario,
}) {
  const recommendedScenarios = scenarios.slice(0, 3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* HERO BANNER */}
      <div className="card-dark" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760, position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255, 255, 255, 0.08)', padding: '5px 12px', borderRadius: 9999, border: '1px solid rgba(255, 255, 255, 0.15)', width: 'fit-content' }}>
            <SparkleIcon style={{ width: 14, height: 14, color: '#FFFFFF' }} />
            <span style={{ fontSize: '0.78rem', color: '#FFFFFF', fontWeight: 500 }}>
              AI Sales Enablement Coach • Sẵn sàng hỗ trợ
            </span>
          </div>

          <h1 style={{ fontSize: '2.2rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#FFFFFF', lineHeight: 1.2 }}>
            Chào buổi sáng, {advisorProfile.name.split(' ').slice(-1)[0]}! 👋
          </h1>

          <p style={{ fontSize: '0.98rem', color: '#A3A3A3', lineHeight: 1.5 }}>
            Tra cứu thông số, chính sách bán hàng hoặc bước vào phòng thực chiến đàm phán cùng AI Customer.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              className="btn-white"
              onClick={() => onNavigate('roleplay')}
            >
              <RoleplayIcon style={{ width: 16, height: 16 }} />
              <span>Phòng Thực chiến →</span>
            </button>

            <button
              className="btn-outline-dark"
              onClick={() => onNavigate('copilot')}
            >
              <RobotIcon style={{ width: 16, height: 16 }} />
              <span>Tra cứu Copilot</span>
            </button>
          </div>
        </div>
      </div>

      {/* QUICK START SECTION */}
      <div>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111111', display: 'flex', alignItems: 'center', gap: 8 }}>
            Khởi động nhanh
            <span style={{ fontSize: '0.85rem', fontWeight: 400, color: '#737373' }}>
              Chọn phương thức học tập bạn muốn
            </span>
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {/* Card 1: Copilot */}
          <div
            className="card-white card-white-hover"
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={() => onNavigate('copilot')}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#F4F4F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111111' }}>
                  <RobotIcon style={{ width: 20, height: 20 }} />
                </div>
                <ChevronRight style={{ width: 18, height: 18, color: '#A3A3A3' }} />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111111', marginBottom: 6 }}>
                Trợ lý Copilot
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#737373', lineHeight: 1.4 }}>
                Tra cứu thông số xe, biểu phí pin và ưu đãi trước bạ 0%.
              </p>
            </div>
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid #F0F0EE', fontSize: '0.85rem', fontWeight: 600, color: '#111111', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Mở phòng hội thoại AI</span>
              <ArrowRight style={{ width: 14, height: 14 }} />
            </div>
          </div>

          {/* Card 2: Role-play */}
          <div
            className="card-white card-white-hover"
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={() => onNavigate('roleplay')}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#F4F4F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111111' }}>
                  <RoleplayIcon style={{ width: 20, height: 20 }} />
                </div>
                <ChevronRight style={{ width: 18, height: 18, color: '#A3A3A3' }} />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111111', marginBottom: 6 }}>
                Thực chiến Role-play
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#737373', lineHeight: 1.4 }}>
                Mô phỏng tư vấn khách hàng thực tế và chấm điểm 5 tiêu chí Rubric.
              </p>
            </div>
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid #F0F0EE', fontSize: '0.85rem', fontWeight: 600, color: '#111111', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Chọn kịch bản & Bắt đầu</span>
              <ArrowRight style={{ width: 14, height: 14 }} />
            </div>
          </div>

          {/* Card 3: Knowledge */}
          <div
            className="card-white card-white-hover"
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={() => onNavigate('knowledge')}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#F4F4F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111111' }}>
                  <BookIcon style={{ width: 20, height: 20 }} />
                </div>
                <ChevronRight style={{ width: 18, height: 18, color: '#A3A3A3' }} />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111111', marginBottom: 6 }}>
                Cẩm nang Sản phẩm & Chính sách
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#737373', lineHeight: 1.4 }}>
                Thông số kỹ thuật dải xe VF 3 - VF 9 và bài so sánh xe xăng đối thủ.
              </p>
            </div>
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid #F0F0EE', fontSize: '0.85rem', fontWeight: 600, color: '#111111', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Xem danh mục tài liệu</span>
              <ArrowRight style={{ width: 14, height: 14 }} />
            </div>
          </div>
        </div>
      </div>

      {/* 2-COLUMN SECTION: RECOMMENDED SCENARIOS + COMPETENCY */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 380px)', gap: 24, alignItems: 'start' }}>
        {/* LEFT COLUMN: SCENARIOS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111111' }}>
                Kịch bản Luyện tập Đề xuất
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#737373' }}>
                Dựa trên mục tiêu rèn luyện và các kỹ năng cần củng cố
              </p>
            </div>
            <button
              onClick={() => onNavigate('roleplay')}
              style={{ fontSize: '0.82rem', fontWeight: 600, color: '#111111', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <span>Xem tất cả ({scenarios.length})</span>
              <ChevronRight style={{ width: 14, height: 14 }} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {recommendedScenarios.map((scenario) => (
              <div
                key={scenario.scenario_id}
                className="card-white card-white-hover"
                style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                {/* Badges row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Badge variant="highlight">{scenario.model_badge || scenario.model || 'VinFast'}</Badge>
                  <Badge variant="default">Độ khó: {scenario.difficulty}</Badge>
                  <span style={{ fontSize: '0.78rem', color: '#737373', display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
                    <ClockIcon style={{ width: 12, height: 12 }} />
                    {scenario.duration}
                  </span>
                </div>

                {/* Title */}
                <h3 style={{ fontSize: '1.02rem', fontWeight: 700, color: '#111111', lineHeight: 1.35 }}>
                  {scenario.title}
                </h3>

                {/* Customer Persona & Action */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img
                      src={scenario.persona?.avatar}
                      alt={scenario.persona?.name}
                      style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div style={{ fontSize: '0.82rem', color: '#555555' }}>
                      <span style={{ fontWeight: 600, color: '#111111' }}>Khách hàng: </span>
                      {scenario.persona?.name} ({scenario.persona?.role})
                    </div>
                  </div>

                  <button
                    className="btn-primary"
                    style={{ padding: '8px 18px', fontSize: '0.82rem' }}
                    onClick={() => onStartScenario(scenario.scenario_id)}
                  >
                    <span>Bắt đầu</span>
                    <ArrowRight style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: ADVISOR COMPETENCY */}
        <div className="card-white" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F0F0EE', paddingBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#F4F4F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BullseyeIcon style={{ width: 16, height: 16, color: '#111111' }} />
              </div>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#111111' }}>
                Năng lực Tư vấn của Bạn
              </h3>
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#111111' }}>
              {advisorProfile.overall_score} <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#737373' }}>/ 100</span>
            </div>
          </div>

          {/* Progress Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {rubricCriteria.map((item) => (
              <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                  <span style={{ fontWeight: 500, color: '#262626' }}>{item.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 700, color: '#111111' }}>{item.score}%</span>
                    {item.status === 'attention' && (
                      <span style={{ fontSize: '0.72rem', color: '#854D0E', backgroundColor: '#FEFCE8', padding: '1px 6px', borderRadius: 4, border: '1px solid #FEF08A' }}>
                        Cần rèn luyện
                      </span>
                    )}
                  </div>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${item.score}%`,
                      backgroundColor: item.status === 'attention' ? '#555555' : '#111111',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid #F0F0EE', paddingTop: 14, textAlign: 'center' }}>
            <button
              onClick={() => onNavigate('progress')}
              style={{ fontSize: '0.82rem', fontWeight: 600, color: '#111111', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <span>Xem chi tiết hồ sơ năng lực</span>
              <ChevronRight style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
