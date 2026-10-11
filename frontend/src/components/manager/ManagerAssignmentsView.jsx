import { useCallback, useEffect, useState } from 'react';
import { managerApi } from '../../api/managerApi';
import { practiceApi } from '../../api/practiceApi';

const STATUS = { assigned: 'Đã giao', in_progress: 'Đang luyện', completed: 'Hoàn thành' };

function todayLocalDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function ManagerAssignmentsView() {
  const [assignments, setAssignments] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', advisor_id: '', scenario_id: '', due_date: '' });

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const [assignmentList, advisorList, scenarioList] = await Promise.all([
        managerApi.getAssignments(), managerApi.getAdvisors(), practiceApi.getScenarios(),
      ]);
      setAssignments(assignmentList);
      setAdvisors(advisorList);
      setScenarios(scenarioList);
      setStatus('ready');
    } catch (cause) {
      setError(cause.message || 'Không thể tải bài được giao.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([managerApi.getAssignments(), managerApi.getAdvisors(), practiceApi.getScenarios()])
      .then(([assignmentList, advisorList, scenarioList]) => {
        if (!active) return;
        setAssignments(assignmentList);
        setAdvisors(advisorList);
        setScenarios(scenarioList);
        setStatus('ready');
      }).catch((cause) => {
        if (!active) return;
        setError(cause.message || 'Không thể tải bài được giao.');
        setStatus('error');
      });
    return () => { active = false; };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const created = await managerApi.createAssignment({
        title: form.title.trim(), advisor_id: form.advisor_id,
        scenario_id: form.scenario_id, due_date: form.due_date || null,
      });
      setAssignments((current) => [created, ...current]);
      setForm({ title: '', advisor_id: '', scenario_id: '', due_date: '' });
    } catch (cause) {
      setError(cause.message || 'Không thể giao bài. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const advisorNames = Object.fromEntries(advisors.map((item) => [item.advisor_id, item.display_name]));
  const scenarioNames = Object.fromEntries(scenarios.map((item) => [item.scenario_id, item.title]));

  return (
    <section className="card-white" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div><h2>Giao bài luyện tập</h2><p>Mỗi bài gắn với một Advisor và một kịch bản Practice thật.</p></div>
        <button type="button" className="btn-outline" onClick={load} disabled={status === 'loading'}>Làm mới</button>
      </div>
      {status === 'loading' && <p role="status">Đang tải bài luyện tập…</p>}
      {error && <p role="alert">{error} {status === 'error' && <button type="button" onClick={load}>Thử lại</button>}</p>}
      {status === 'ready' && (
        <>
          <form onSubmit={submit} style={{ display: 'grid', gap: 12, margin: '24px 0', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
            <label>Tiêu đề bài tập<input required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ví dụ: Tư vấn VF 5 cho khách chạy dịch vụ" /></label>
            <label>Tư vấn viên<select required value={form.advisor_id} onChange={(event) => setForm({ ...form, advisor_id: event.target.value })}>
              <option value="">Chọn tư vấn viên</option>{advisors.map((item) => <option key={item.advisor_id} value={item.advisor_id}>{item.display_name}</option>)}
            </select></label>
            <label>Kịch bản<select required value={form.scenario_id} onChange={(event) => setForm({ ...form, scenario_id: event.target.value })}>
              <option value="">Chọn kịch bản</option>{scenarios.map((item) => <option key={item.scenario_id} value={item.scenario_id}>{item.title}</option>)}
            </select></label>
            <label>Hạn hoàn thành<input type="date" min={todayLocalDate()} value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} /></label>
            <button type="submit" className="btn-primary" disabled={saving || advisors.length === 0 || scenarios.length === 0}>{saving ? 'Đang giao…' : 'Giao bài'}</button>
          </form>
          {advisors.length === 0 && <p>Chưa có tài khoản Advisor hoạt động để giao bài.</p>}
          <h3>Danh sách bài đã giao</h3>
          {assignments.length === 0 ? <p>Chưa có bài nào được giao.</p> : (
            <div style={{ display: 'grid', gap: 12 }}>
              {assignments.map((item) => <article key={item.assignment_id} className="card-white" style={{ padding: 16, border: '1px solid #e5e5e5' }}>
                <strong>{item.title}</strong><p>{advisorNames[item.advisor_id] || item.advisor_id} · {scenarioNames[item.scenario_id] || item.scenario_id}</p>
                <small>{STATUS[item.status] || item.status} · Hạn: {item.due_date || 'Không đặt'}{item.session_id && ` · Phiên: ${item.session_id}`}</small>
              </article>)}
            </div>
          )}
        </>
      )}
    </section>
  );
}
