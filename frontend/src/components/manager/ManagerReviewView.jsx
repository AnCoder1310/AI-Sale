import { useCallback, useEffect, useState } from 'react';
import { managerApi } from '../../api/managerApi';
import { ManagerReviewModal } from './ManagerReviewModal';

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function ManagerReviewView({ currentUser, onLogout }) {
  const [queue, setQueue] = useState([]);
  const [queueStatus, setQueueStatus] = useState('loading');
  const [queueError, setQueueError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailStatus, setDetailStatus] = useState('idle');

  const loadQueue = useCallback(async () => {
    setQueueStatus('loading');
    setQueueError('');
    try {
      const items = await managerApi.getReviewQueue();
      setQueue(Array.isArray(items) ? items : []);
      setQueueStatus('ready');
    } catch (error) {
      setQueueError(error.message || 'Không thể tải hàng đợi đánh giá.');
      setQueueStatus('error');
    }
  }, []);

  useEffect(() => {
    let active = true;
    managerApi.getReviewQueue()
      .then((items) => {
        if (!active) return;
        setQueue(Array.isArray(items) ? items : []);
        setQueueStatus('ready');
      })
      .catch((error) => {
        if (!active) return;
        setQueueError(error.message || 'Không thể tải hàng đợi đánh giá.');
        setQueueStatus('error');
      });
    return () => { active = false; };
  }, []);

  const openReview = async (sessionId) => {
    setDetailStatus('loading');
    setQueueError('');
    try {
      setSelected(await managerApi.getReviewDetail(sessionId));
      setDetailStatus('ready');
    } catch (error) {
      setDetailStatus('idle');
      setQueueError(error.message || 'Không thể tải chi tiết phiên luyện tập.');
    }
  };

  const approve = async (decision) => {
    await managerApi.approveReview(selected.attempt.session_id, decision);
    setQueue((items) => items.filter((item) => item.session_id !== selected.attempt.session_id));
    setSelected(null);
    setDetailStatus('idle');
  };

  return (
    <div className="manager-review-shell">
      <header className="manager-topbar">
        <div className="manager-brand">
          <span>◇</span>
          <div><strong>AI Sales Coach</strong><small>Manager Review</small></div>
        </div>
        <div className="manager-identity">
          <div><strong>{currentUser.display_name}</strong><span>Quản lý đào tạo</span></div>
          <button type="button" onClick={onLogout}>Đăng xuất</button>
        </div>
      </header>

      <main className="manager-review-main">
        <section className="manager-review-hero">
          <div>
            <span className="manager-kicker">◇ Human-In-The-Loop</span>
            <h1>Danh sách chờ duyệt đánh giá</h1>
            <p>Đọc transcript và evidence trước khi xác nhận hoặc điều chỉnh điểm AI.</p>
          </div>
          <div className="manager-review-count">
            <strong>{queue.length}</strong>
            <span>phiên chờ duyệt</span>
          </div>
        </section>

        <section className="manager-queue-card">
          <div className="manager-queue-heading">
            <div><h2>Review queue</h2><p>Kết quả mới nhất trước; mỗi attempt chỉ được duyệt một lần.</p></div>
            <button type="button" onClick={loadQueue} disabled={queueStatus === 'loading'}>↻ Tải lại</button>
          </div>

          {queueError && <div className="manager-queue-error" role="alert">{queueError}</div>}
          {queueStatus === 'loading' && <div className="manager-queue-state" role="status">Đang tải hàng đợi…</div>}
          {queueStatus === 'ready' && queue.length === 0 && (
            <div className="manager-queue-state"><strong>✓ Không có phiên đang chờ</strong><span>Các AI draft mới sẽ xuất hiện tại đây.</span></div>
          )}
          {queueStatus === 'ready' && queue.length > 0 && (
            <div className="manager-review-list">
              {queue.map((attempt) => (
                <article key={attempt.session_id} className="manager-review-row">
                  <div className="manager-review-avatar">TV</div>
                  <div className="manager-review-info">
                    <div><strong>{attempt.advisor_id}</strong><span>{attempt.scenario_id}</span></div>
                    <p>Hoàn thành: {formatDate(attempt.completed_at)}</p>
                    <small>Session: {attempt.session_id}</small>
                  </div>
                  <div className="manager-ai-score">
                    <span>AI draft</span>
                    <strong>{attempt.ai_score?.toFixed(1) || '—'}<small>/5</small></strong>
                  </div>
                  <button type="button" onClick={() => openReview(attempt.session_id)}>
                    {detailStatus === 'loading' ? 'Đang mở…' : 'Thẩm định điểm →'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {selected && detailStatus === 'ready' && (
        <ManagerReviewModal detail={selected} onClose={() => setSelected(null)} onApprove={approve} />
      )}
    </div>
  );
}
