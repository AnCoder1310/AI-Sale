import { useCallback, useEffect, useState } from 'react';
import { practiceApi } from '../../api/practiceApi';

const STATUS = { assigned: 'Chưa bắt đầu', in_progress: 'Đang luyện', completed: 'Hoàn thành' };

export function AdvisorAssignmentsView({ scenarios, onStart, onOpenAttempt, reloadToken }) {
  const [assignments, setAssignments] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      setAssignments(await practiceApi.getAssignments());
      setStatus('ready');
    } catch (cause) {
      setError(cause.message || 'Không thể tải bài được giao.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let active = true;
    practiceApi.getAssignments().then((items) => {
      if (!active) return;
      setAssignments(items);
      setStatus('ready');
    }).catch((cause) => {
      if (!active) return;
      setError(cause.message || 'Không thể tải bài được giao.');
      setStatus('error');
    });
    return () => { active = false; };
  }, [reloadToken]);

  const scenarioNames = Object.fromEntries(scenarios.map((item) => [item.scenario_id, item.title]));
  return (
    <section className="card-white" style={{ padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div><h2>Bài được giao</h2><p>Luyện đúng kịch bản để Manager theo dõi tiến độ của bài.</p></div>
        <button type="button" className="btn-outline" onClick={load} disabled={status === 'loading'}>Làm mới</button>
      </div>
      {status === 'loading' && <p role="status">Đang tải bài được giao…</p>}
      {status === 'error' && <p role="alert">{error} <button type="button" onClick={load}>Thử lại</button></p>}
      {status === 'ready' && assignments.length === 0 && <p>Chưa có bài nào được giao. Bạn vẫn có thể chọn kịch bản bên dưới để tự luyện.</p>}
      {status === 'ready' && <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        {assignments.map((assignment) => <article key={assignment.assignment_id} style={{ padding: 14, border: '1px solid #e5e5e5', borderRadius: 10 }}>
          <strong>{assignment.title}</strong><p>{scenarioNames[assignment.scenario_id] || assignment.scenario_id}</p>
          <small>{STATUS[assignment.status] || assignment.status} · Hạn: {assignment.due_date || 'Không đặt'}</small>
          <div style={{ marginTop: 10 }}>
            {assignment.status === 'completed' && assignment.session_id ?
              <button type="button" className="btn-outline" onClick={() => onOpenAttempt(assignment.session_id)}>Xem kết quả</button> :
              <button type="button" className="btn-primary" onClick={() => onStart(assignment)} disabled={!scenarioNames[assignment.scenario_id]}>
                {assignment.status === 'in_progress' ? 'Bắt đầu lại bài này' : 'Bắt đầu bài được giao'}
              </button>}
          </div>
        </article>)}
      </div>}
    </section>
  );
}
