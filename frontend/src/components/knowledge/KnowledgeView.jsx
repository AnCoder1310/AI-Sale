import { useState } from 'react';
import {
  SearchIcon,
  BookIcon,
  ChevronRight,
  SparkleIcon,
} from '../common/Icons';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { VEHICLES } from '../../data/vehicleData';
import { POLICIES } from '../../data/policyData';
import { FAQ_QUESTIONS } from '../../data/faqData';
import { copilotApi } from '../../api/copilotApi';

export function KnowledgeView({ onOpenCopilotQuery }) {
  const [subTab, setSubTab] = useState('vehicles'); // 'vehicles' | 'policies' | 'faq'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);

  const filteredVehicles = VEHICLES.filter(
    (v) =>
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.segment.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.tagline.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPolicies = POLICIES.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.summary.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFaqs = FAQ_QUESTIONS.filter(
    (f) =>
      f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenDocument = async (docId, fallbackTitle = '') => {
    try {
      const doc = await copilotApi.getSource(docId);
      setSelectedDocument(doc);
    } catch {
      // Fallback display if backend is offline
      const foundPolicy = POLICIES.find((p) => p.document_id === docId);
      setSelectedDocument({
        document_id: docId,
        title: foundPolicy?.title || fallbackTitle || docId,
        document_type: 'policy',
        effective_date: foundPolicy?.effective_date || '2026-09-01',
        content: foundPolicy?.summary + '\n\n' + (foundPolicy?.key_points || []).map((k) => `• ${k}`).join('\n'),
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* HEADER & TABS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5', padding: '4px 10px', borderRadius: 9999, marginBottom: 8 }}>
            <BookIcon style={{ width: 13, height: 13, color: '#111111' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#111111' }}>
              Kho Kiến thức & Cẩm nang 2026
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#111111', letterSpacing: '-0.02em' }}>
            Cẩm nang Sản phẩm & Chính sách Bán hàng
          </h1>
          <p style={{ fontSize: '0.88rem', color: '#737373', marginTop: 4 }}>
            Tra cứu thông số kỹ thuật chuẩn hóa, chính sách pin, ưu đãi sạc V-GREEN và giải đáp câu hỏi thường gặp.
          </p>
        </div>

        {/* SEARCH BAR */}
        <div style={{ position: 'relative', width: 280 }}>
          <SearchIcon style={{ position: 'absolute', left: 12, top: 12, width: 16, height: 16, color: '#888888' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm tài liệu, dòng xe..."
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: 9999,
              border: '1px solid #E5E5E5',
              backgroundColor: '#FFFFFF',
              outline: 'none',
              fontSize: '0.85rem',
            }}
          />
        </div>
      </div>

      {/* SUB-TABS */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #E5E5E5', paddingBottom: 10 }}>
        <button
          className={`chip ${subTab === 'vehicles' ? 'active' : ''}`}
          onClick={() => setSubTab('vehicles')}
        >
          🚗 Dải xe VinFast ({VEHICLES.length})
        </button>
        <button
          className={`chip ${subTab === 'policies' ? 'active' : ''}`}
          onClick={() => setSubTab('policies')}
        >
          📄 Chính sách & Biểu phí ({POLICIES.length})
        </button>
        <button
          className={`chip ${subTab === 'faq' ? 'active' : ''}`}
          onClick={() => setSubTab('faq')}
        >
          ❓ Câu hỏi thường gặp FAQ ({FAQ_QUESTIONS.length})
        </button>
      </div>

      {/* 1. VEHICLES TAB */}
      {subTab === 'vehicles' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
          {filteredVehicles.map((v) => (
            <div
              key={v.id}
              className="card-white card-white-hover"
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <Badge variant="highlight">{v.model}</Badge>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111111', marginTop: 6 }}>
                      {v.name}
                    </h2>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#737373', fontWeight: 500 }}>
                    {v.segment}
                  </span>
                </div>

                <p style={{ fontSize: '0.82rem', color: '#555555', fontStyle: 'italic', marginBottom: 14 }}>
                  "{v.tagline}"
                </p>

                {/* Specs Highlights */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 10,
                    padding: '12px 14px',
                    backgroundColor: '#F9F9F8',
                    borderRadius: 10,
                    border: '1px solid #ECECE8',
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#737373', display: 'block' }}>Quãng đường:</span>
                    <strong style={{ fontSize: '0.85rem', color: '#111111' }}>{v.range}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#737373', display: 'block' }}>Công suất:</span>
                    <strong style={{ fontSize: '0.85rem', color: '#111111' }}>{v.power}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#737373', display: 'block' }}>Dung lượng Pin:</span>
                    <strong style={{ fontSize: '0.85rem', color: '#111111' }}>{v.battery_capacity}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#737373', display: 'block' }}>Sạc nhanh DC:</span>
                    <strong style={{ fontSize: '0.85rem', color: '#111111' }}>{v.charging_time}</strong>
                  </div>
                </div>

                {/* Price */}
                <div style={{ fontSize: '0.8rem', color: '#444444' }}>
                  <div>Giá thuê pin: <strong>{v.price_battery_rental}</strong></div>
                  <div>Giá kèm pin: <strong>{v.price_battery_included}</strong></div>
                </div>
              </div>

              <div style={{ paddingTop: 14, borderTop: '1px solid #F0F0EE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#737373' }}>
                  Bảo hành: {v.warranty_car}
                </span>
                <button
                  className="btn-outline"
                  onClick={() => setSelectedVehicle(v)}
                  style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                >
                  <span>Chi tiết kỹ thuật</span>
                  <ChevronRight style={{ width: 12, height: 12 }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. POLICIES TAB */}
      {subTab === 'policies' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filteredPolicies.map((p) => (
            <div
              key={p.id}
              className="card-white card-white-hover"
              style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Badge variant="highlight">{p.category}</Badge>
                    <span style={{ fontSize: '0.75rem', color: '#737373' }}>
                      Hiệu lực: {p.effective_date}
                    </span>
                    <Badge variant="default">{p.status}</Badge>
                  </div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111111' }}>
                    {p.title}
                  </h3>
                </div>

                <button
                  className="btn-primary"
                  style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                  onClick={() => handleOpenDocument(p.document_id, p.title)}
                >
                  <span>Xem toàn văn</span>
                  <ChevronRight style={{ width: 12, height: 12 }} />
                </button>
              </div>

              <p style={{ fontSize: '0.88rem', color: '#444444', lineHeight: 1.5 }}>
                {p.summary}
              </p>

              <div style={{ backgroundColor: '#F9F9F8', padding: '12px 16px', borderRadius: 8, border: '1px solid #ECECE8' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#111111', display: 'block', marginBottom: 6 }}>
                  ĐIỀU KHOẢN CỐT LÕI TƯ VẤN VIÊN CẦN NẮM:
                </span>
                <ul style={{ listStyle: 'none', paddingLeft: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {p.key_points.map((pt, idx) => (
                    <li key={idx} style={{ fontSize: '0.82rem', color: '#333333', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <span>✓</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. FAQ TAB */}
      {subTab === 'faq' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredFaqs.map((f) => (
            <div
              key={f.id}
              className="card-white"
              style={{
                padding: '18px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Badge variant="default">{f.category}</Badge>
                </div>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#111111', marginBottom: 4 }}>
                  {f.question}
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#666666' }}>{f.preview}</p>
              </div>

              <button
                className="btn-outline"
                onClick={() => onOpenCopilotQuery && onOpenCopilotQuery(f.query)}
                style={{ flexShrink: 0, padding: '8px 14px', fontSize: '0.8rem' }}
              >
                <span>Hỏi Copilot</span>
                <SparkleIcon style={{ width: 13, height: 13 }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* VEHICLE DETAIL MODAL */}
      <Modal
        isOpen={Boolean(selectedVehicle)}
        onClose={() => setSelectedVehicle(null)}
        title={selectedVehicle ? `${selectedVehicle.name} — Thông số chi tiết` : ''}
        maxWidth={720}
      >
        {selectedVehicle && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ fontSize: '0.9rem', color: '#555555', fontStyle: 'italic', marginBottom: 12 }}>
                "{selectedVehicle.tagline}"
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div style={{ padding: 12, backgroundColor: '#F7F7F5', borderRadius: 8 }}>
                  <span style={{ fontSize: '0.72rem', color: '#737373' }}>Kích thước (D x R x C):</span>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{selectedVehicle.dimensions}</div>
                </div>
                <div style={{ padding: 12, backgroundColor: '#F7F7F5', borderRadius: 8 }}>
                  <span style={{ fontSize: '0.72rem', color: '#737373' }}>Chiều dài cơ sở:</span>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{selectedVehicle.wheelbase}</div>
                </div>
                <div style={{ padding: 12, backgroundColor: '#F7F7F5', borderRadius: 8 }}>
                  <span style={{ fontSize: '0.72rem', color: '#737373' }}>Khoảng sáng gầm:</span>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{selectedVehicle.ground_clearance}</div>
                </div>
                <div style={{ padding: 12, backgroundColor: '#F7F7F5', borderRadius: 8 }}>
                  <span style={{ fontSize: '0.72rem', color: '#737373' }}>Hệ thống truyền động:</span>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{selectedVehicle.drivetrain}</div>
                </div>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8 }}>
                🛡️ Công nghệ An toàn & Hỗ trợ Lái ADAS:
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedVehicle.adas_features.map((item, idx) => (
                  <span
                    key={idx}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      backgroundColor: '#F0F0EE',
                      fontSize: '0.8rem',
                      color: '#222222',
                    }}
                  >
                    ✓ {item}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8 }}>
                ✨ Điểm nhấn nổi bật khi tư vấn khách:
              </h4>
              <ul style={{ listStyle: 'none', paddingLeft: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectedVehicle.highlights.map((h, idx) => (
                  <li key={idx} style={{ fontSize: '0.82rem', color: '#444444', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <span>•</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ borderTop: '1px solid #E5E5E5', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#666666' }}>
                Tài liệu gốc: <code>{selectedVehicle.document_id}</code>
              </span>
              <button
                className="btn-primary"
                onClick={() => {
                  setSelectedVehicle(null);
                  onOpenCopilotQuery && onOpenCopilotQuery(`Tư vấn thông số kỹ thuật và so sánh xe ${selectedVehicle.name}`);
                }}
                style={{ fontSize: '0.82rem', padding: '8px 16px' }}
              >
                <span>Hỏi kịch bản tư vấn với Copilot</span>
                <SparkleIcon style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* DOCUMENT VIEWER MODAL */}
      <Modal
        isOpen={Boolean(selectedDocument)}
        onClose={() => setSelectedDocument(null)}
        title={selectedDocument ? selectedDocument.title : ''}
        maxWidth={780}
      >
        {selectedDocument && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.78rem', color: '#737373', borderBottom: '1px solid #F0F0EE', paddingBottom: 10 }}>
              <span>Mã văn bản: <strong>{selectedDocument.document_id}</strong></span>
              <span>•</span>
              <span>Ngày hiệu lực: <strong>{selectedDocument.effective_date}</strong></span>
              <span>•</span>
              <span>Trạng thái: <strong>Đang có hiệu lực</strong></span>
            </div>

            <div
              style={{
                fontSize: '0.88rem',
                lineHeight: 1.6,
                color: '#222222',
                whiteSpace: 'pre-wrap',
                maxHeight: '60vh',
                overflowY: 'auto',
                backgroundColor: '#FAFAFA',
                padding: '16px 20px',
                borderRadius: 8,
                border: '1px solid #ECECE8',
              }}
            >
              {selectedDocument.content}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
