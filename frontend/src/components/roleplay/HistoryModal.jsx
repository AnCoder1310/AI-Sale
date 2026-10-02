import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { ClockIcon } from '../common/Icons';

export function HistoryModal({ isOpen, onClose, historyList, onSelectSession }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lịch sử Luyện tập Thực chiến" maxWidth={680}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: '0.85rem', color: '#737373' }}>
          Các phiên thực chiến đã hoàn thành và kết quả đánh giá theo tiêu chuẩn Rubric của VinFast Academy.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {historyList.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                onSelectSession && onSelectSession(item);
                onClose();
              }}
              style={{
                padding: '16px 20px',
                borderRadius: 12,
                border: '1px solid #E5E5E5',
                backgroundColor: '#FAFAFA',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
                e.currentTarget.style.borderColor = '#CFCFCB';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#FAFAFA';
                e.currentTarget.style.borderColor = '#E5E5E5';
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: '0.78rem', color: '#737373', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ClockIcon style={{ width: 12, height: 12 }} />
                    {item.time}
                  </span>
                  <Badge variant="default">{item.model || 'VF'}</Badge>
                </div>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#111111' }}>
                  {item.title}
                </h4>
                <div style={{ fontSize: '0.78rem', color: '#555555', marginTop: 4 }}>
                  Khách hàng: {item.customer} • Thời lượng: {item.duration}
                </div>
              </div>

              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111111' }}>
                  {item.score} <span style={{ fontSize: '0.75rem', color: '#737373' }}>/ 100</span>
                </span>
                <Badge variant={item.score >= 80 ? 'highlight' : 'default'}>
                  {item.score >= 80 ? 'Đạt chuẩn' : 'Cần rèn luyện'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
