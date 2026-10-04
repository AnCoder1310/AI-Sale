import { useCallback, useEffect, useState } from 'react';
import { managerApi } from '../../api/managerApi';
import { ManagerReviewModal } from './ManagerReviewModal';

const PAGE_SIZE = 20;

function statusLabel(attempt) {
  if (attempt.review_status === 'manager_approved') return 'Đã duyệt';
  if (attempt.evaluation_status === 'failed') return 'Chấm điểm lỗi';
  return 'Chờ duyệt';
}

export function ManagerHistoryView() {
  const [advisorId, setAdvisorId] = useState('');
  const [scenarioId, setScenarioId] = useState('');
  const [filters, setFilters] = useState({ advisorId: '', scenarioId: '' });
  const [page, setPage] = useState(0);
  const [attempts, setAttempts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailStatus, setDetailStatus] = useState('idle');

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const items = await managerApi.getAttempts({ ...filters, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      if (!Array.isArray(items)) throw new Error('Danh sách attempt không hợp lệ.');
      setAttempts(items);
      setStatus('ready');
    } catch (loadError) {
      setError(loadError.message || 'Không thể tải lịch sử.');
      setStatus('error');
    }
  }, [filters, page]);

  useEffect(() => {
    let active = true;
    managerApi.getAttempts({ ...filters, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((items) => {
        if (!active) return;
        setAttempts(Array.isArray(items) ? items : []);
        setStatus('ready');
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError.message || 'Không thể tải lịch sử.');
        setStatus('error');
      });
    return () => { active = false; };
  }, [filters, page]);

  const openAttempt = async (sessionId) => {
    setDetailStatus('loading');
    setError('');
    try {
      setSelected(await managerApi.getReviewDetail(sessionId));
      setDetailStatus('ready');
    } catch (loadError) {
      setDetailStatus('idle');
      setError(loadError.message || 'Không thể tải attempt.');
    }
  };

  const approve = async (decision) => {
    await managerApi.approveReview(selected.attempt.session_id, decision);
    setSelected(null);
    setDetailStatus('idle');
    await load();
  };

  return (
    <section className="manager-queue-card">
      <div className="manager-queue-heading">
        <div><h2>Lịch sử luyện tập</h2><p>Tất cả attempt hoàn thành, kể cả những bài cũ không còn ở review queue.</p></div>
        <button type="button" onClick={load} disabled={status === 'loading'}>↻ Tải lại</button>
      </div>
      <form className="manager-filters" onSubmit={(event) => {
        event.preventDefault();
        setStatus('loading');
        setPage(0);
        setFilters({ advisorId, scenarioId });
      }}>
        <label>Mã tư vấn viên<input value={advisorId} onChange={(event) => setAdvisorId(event.target.value)} placeholder="Tất cả" /></label>
        <label>Mã tình huống<input value={scenarioId} onChange={(event) => setScenarioId(event.target.value)} placeholder="Tất cả" /></label>
        <button type="submit">Lọc</button>
      </form>
      {error && <div className="manager-queue-error" role="alert">{error}</div>}
      {status === 'loading' && <div className="manager-queue-state" role="status">Đang tải lịch sử…</div>}
      {status === 'ready' && attempts.length === 0 && <div className="manager-queue-state">Chưa có attempt phù hợp.</div>}
      {status === 'ready' && attempts.length > 0 && (
        <div className="manager-review-list">
          {attempts.map((attempt) => (
            <article className="manager-review-row" key={attempt.session_id}>
              <div className="manager-review-avatar">TV</div>
              <div className="manager-review-info">
                <div><strong>{attempt.advisor_id}</strong><span>{attempt.scenario_id}</span></div>
                <p>{new Date(attempt.completed_at).toLocaleString('vi-VN')} · {statusLabel(attempt)}</p>
                <small>Session: {attempt.session_id}</small>
              </div>
              <div className="manager-ai-score"><span>{attempt.approved_score == null ? 'AI draft' : 'Đã duyệt'}</span><strong>{(attempt.approved_score ?? attempt.ai_score)?.toFixed(1) ?? '—'}<small>/3</small></strong></div>
              <button type="button" onClick={() => openAttempt(attempt.session_id)} disabled={detailStatus === 'loading'}>Xem attempt →</button>
            </article>
          ))}
        </div>
      )}
      {status === 'ready' && (
        <div className="manager-pages">
          <button type="button" disabled={page === 0} onClick={() => { setStatus('loading'); setPage((value) => value - 1); }}>← Trước</button>
          <span>Trang {page + 1}</span>
          <button type="button" disabled={attempts.length < PAGE_SIZE} onClick={() => { setStatus('loading'); setPage((value) => value + 1); }}>Sau →</button>
        </div>
      )}
      {selected && detailStatus === 'ready' && <ManagerReviewModal detail={selected} onClose={() => setSelected(null)} onApprove={approve} />}
    </section>
  );
}
