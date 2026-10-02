import { useState } from 'react';
import {
  ClockIcon,
  ArrowRight,
  SparkleIcon,
} from '../common/Icons';
import { Badge } from '../common/Badge';
import { SKILL_LABELS } from '../../data/scenarioData';

export function ScenarioCatalog({
  scenarios,
  onStartScenario,
  onOpenHistory,
}) {
  const [filterModel, setFilterModel] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');

  const modelOptions = [
    { id: 'all', label: 'Tất cả mẫu xe' },
    { id: 'VF 3', label: 'VF 3' },
    { id: 'VF 5', label: 'VF 5' },
    { id: 'VF 6', label: 'VF 6' },
    { id: 'VF 7', label: 'VF 7' },
    { id: 'VF 8', label: 'VF 8' },
    { id: 'VF 9', label: 'VF 9' },
  ];

  const difficultyOptions = [
    { id: 'all', label: 'Tất cả' },
    { id: 'Cơ bản', label: 'Cơ bản' },
    { id: 'Tiêu chuẩn', label: 'Tiêu chuẩn' },
    { id: 'Nâng cao', label: 'Nâng cao' },
  ];

  const filtered = scenarios.filter((s) => {
    if (filterModel !== 'all' && s.model !== filterModel) return false;
    if (filterDifficulty !== 'all' && s.difficulty !== filterDifficulty) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* PAGE HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ maxWidth: 780 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5', padding: '4px 10px', borderRadius: 9999, marginBottom: 10 }}>
            <SparkleIcon style={{ width: 13, height: 13, color: '#111111' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#111111' }}>
              Phòng Luyện tập AI Customer Simulator
            </span>
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#111111', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
            Chọn Tình Huống Bán Xe & Bắt Đầu Luyện Tập
          </h1>

          <p style={{ fontSize: '0.88rem', color: '#737373', marginTop: 8, lineHeight: 1.5 }}>
            Thử thách bản thân với các kiểu khách hàng thực tế: Kỹ sư công nghệ logic, Doanh nhân bận rộn, Khách hàng truyền thống lo ngại pin. Hệ thống sẽ tự động chấm điểm dựa trên 5 tiêu chí Rubric chuẩn.
          </p>
        </div>

        <button
          onClick={onOpenHistory}
          className="btn-outline"
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          <ClockIcon style={{ width: 14, height: 14 }} />
          <span>Xem Lịch sử Luyện tập</span>
        </button>
      </div>

      {/* FILTER BAR */}
      <div
        className="card-white"
        style={{
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        {/* Model filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#444444' }}>Dòng xe:</span>
          {modelOptions.map((opt) => (
            <button
              key={opt.id}
              className={`chip ${filterModel === opt.id ? 'active' : ''}`}
              onClick={() => setFilterModel(opt.id)}
              style={{ padding: '5px 12px', fontSize: '0.8rem' }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Difficulty filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#444444' }}>Độ khó:</span>
          {difficultyOptions.map((opt) => (
            <button
              key={opt.id}
              className={`chip ${filterDifficulty === opt.id ? 'active' : ''}`}
              onClick={() => setFilterDifficulty(opt.id)}
              style={{ padding: '5px 12px', fontSize: '0.8rem' }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* SCENARIOS 2-COLUMN GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 20 }}>
        {filtered.map((s) => (
          <div
            key={s.scenario_id}
            className="card-white card-white-hover"
            style={{
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div>
              {/* Badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <Badge variant="highlight">{s.model_badge || s.model}</Badge>
                <Badge variant="default">Độ khó: {s.difficulty}</Badge>
                <span style={{ fontSize: '0.78rem', color: '#737373', display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 2 }}>
                  <ClockIcon style={{ width: 12, height: 12 }} />
                  ~{s.duration}
                </span>
              </div>

              {/* Title */}
              <h2 style={{ fontSize: '1.08rem', fontWeight: 700, color: '#111111', lineHeight: 1.35, marginBottom: 14 }}>
                {s.title}
              </h2>

              {/* Persona Box */}
              <div
                style={{
                  backgroundColor: '#F7F7F5',
                  border: '1px solid #ECECE8',
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                  marginBottom: 14,
                }}
              >
                <img
                  src={s.persona?.avatar}
                  alt={s.persona?.name}
                  style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111111' }}>
                    {s.persona?.name} ({s.persona?.age} tuổi) <span style={{ fontWeight: 400, color: '#737373' }}>| {s.persona?.role}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#444444', lineHeight: 1.4 }}>
                    <strong>Tính cách:</strong> {s.persona?.communication_style}
                  </div>
                </div>
              </div>

              {/* Objective */}
              <p style={{ fontSize: '0.82rem', color: '#444444', lineHeight: 1.45, marginBottom: 14 }}>
                <strong>Mục tiêu:</strong> {s.training_objective}
              </p>

              {/* Target skill tags */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {(s.target_skills || []).map((skill, idx) => (
                  <span
                    key={idx}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 4,
                      backgroundColor: '#ECECE9',
                      color: '#333333',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                    }}
                  >
                    {SKILL_LABELS[skill] || skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Bottom Footer Row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 14,
                borderTop: '1px solid #F0F0EE',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <span style={{ fontSize: '0.82rem', color: '#737373' }}>
                {s.budget || 'Ngân sách: Đang tư vấn'}
              </span>

              <button
                className="btn-primary"
                onClick={() => onStartScenario(s.scenario_id)}
                style={{ padding: '8px 18px', fontSize: '0.85rem' }}
              >
                <span>Vào phòng luyện tập</span>
                <ArrowRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
