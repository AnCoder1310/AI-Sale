import {
  SparkleIcon,
  RoleplayIcon,
  RobotIcon,
  BookIcon,
  ArrowRight,
  ChevronRight,
} from '../common/Icons';
import { Badge } from '../common/Badge';
import { getVehicleImage } from '../../data/vehicleData';

export function HomeView({
  advisorProfile,
  scenarios,
  onNavigate,
  onStartScenario,
}) {
  const recommendedScenarios = scenarios.slice(0, 3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* HERO BANNER */}
      <div className="card-dark" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Subtle Hero Vehicle Visual Accent */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '48%',
            minWidth: 260,
            backgroundImage: "linear-gradient(to right, #14161F 0%, rgba(20,22,31,0.75) 30%, rgba(20,22,31,0.2) 100%), url('/vehicles/vf-7.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center 40%',
            opacity: 0.45,
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
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
                {/* Badges & Vehicle Thumbnail row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Badge variant="highlight">{scenario.model_badge || scenario.model || 'VinFast'}</Badge>
                    <Badge variant="default">Độ khó: {scenario.difficulty}</Badge>
                    <span style={{ fontSize: '0.78rem', color: '#737373' }}>Tối đa {scenario.max_turns} lượt</span>
                  </div>
                  {getVehicleImage(scenario.model_badge || scenario.model || scenario.title) && (
                    <div
                      style={{
                        width: 58,
                        height: 36,
                        borderRadius: 6,
                        overflow: 'hidden',
                        flexShrink: 0,
                        backgroundColor: '#141722',
                        border: '1px solid #E5E7EB',
                      }}
                    >
                      <img
                        src={getVehicleImage(scenario.model_badge || scenario.model || scenario.title)}
                        alt={scenario.model_badge || scenario.model || 'VinFast'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  )}
                </div>

                {/* Title */}
                <h3 style={{ fontSize: '1.02rem', fontWeight: 700, color: '#111111', lineHeight: 1.35 }}>
                  {scenario.title}
                </h3>

                {/* Customer Persona & Action */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: '0.82rem', color: '#555555' }}>
                      <span style={{ fontWeight: 600, color: '#111111' }}>Kênh: </span>
                      {scenario.sales_channel || 'Tư vấn trực tuyến'}
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

        <div className="card-white" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ fontSize: '0.98rem', fontWeight: 700 }}>Theo dõi năng lực</h3>
          <p style={{ fontSize: '0.85rem', color: '#666666', lineHeight: 1.5 }}>
            Sau khi luyện tập, bạn có thể xem điểm và bằng chứng cho từng tiêu chí ngay trên màn hình kết quả.
            Dashboard tổng hợp tiến bộ chưa có dữ liệu thật trong MVP này.
          </p>
          <button className="btn-outline" onClick={() => onNavigate('roleplay')}>Bắt đầu luyện tập</button>
        </div>
      </div>
    </div>
  );
}
