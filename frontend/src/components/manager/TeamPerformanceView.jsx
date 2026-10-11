import { useCallback, useEffect, useState } from 'react';
import { managerApi } from '../../api/managerApi';

const SKILLS = {
  need_discovery: 'Khám phá nhu cầu',
  product_knowledge: 'Kiến thức sản phẩm',
  objection_handling: 'Xử lý phản đối',
  policy_accuracy: 'Độ chính xác chính sách',
  closing_next_step: 'Chốt bước tiếp theo',
};

export function TeamPerformanceView() {
  const [advisors, setAdvisors] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      setAdvisors(await managerApi.getAdvisors());
      setStatus('ready');
    } catch (cause) {
      setError(cause.message || 'Không thể tải năng lực đội ngũ.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let active = true;
    managerApi.getAdvisors().then((items) => {
      if (!active) return;
      setAdvisors(items);
      setStatus('ready');
    }).catch((cause) => {
      if (!active) return;
      setError(cause.message || 'Không thể tải năng lực đội ngũ.');
      setStatus('error');
    });
    return () => { active = false; };
  }, []);

  return (
    <section className="card-white" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div><h2>Năng lực đội ngũ</h2><p>Chỉ tính điểm các phiên đã được Manager duyệt. Cần ít nhất 3 phiên có điểm để xếp hạng.</p></div>
        <button type="button" className="btn-outline" onClick={load} disabled={status === 'loading'}>Làm mới</button>
      </div>
      {status === 'loading' && <p role="status">Đang tính điểm từ các phiên đã duyệt…</p>}
      {status === 'error' && <p role="alert">{error} <button type="button" onClick={load}>Thử lại</button></p>}
      {status === 'ready' && advisors.length === 0 && <p>Chưa có tài khoản Advisor hoạt động.</p>}
      {status === 'ready' && <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
        {advisors.map((advisor) => <article key={advisor.advisor_id} className="card-white" style={{ padding: 18, border: '1px solid #e5e5e5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div><h3>{advisor.display_name}</h3><small>{advisor.completed_sessions} phiên hoàn thành · {advisor.approved_sessions} đã duyệt</small></div>
            <div style={{ textAlign: 'right' }}>
              <strong>{advisor.average_score == null ? 'Chưa có điểm' : `${advisor.average_score.toFixed(2)}/3`}</strong><br />
              <small>{advisor.rank == null ? `Chưa xếp hạng (${advisor.scored_sessions}/3 phiên có điểm)` : `Hạng ${advisor.rank}`}</small>
            </div>
          </div>
          {advisor.skill_summaries.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
            {advisor.skill_summaries.map((skill) => <span key={skill.criterion}>
              {SKILLS[skill.criterion] || skill.criterion}: <strong>{skill.average_score.toFixed(1)}/3</strong> <small>({skill.assessed_count} bài)</small>
            </span>)}
          </div>}
          {advisor.recent_scores.length > 0 && <p style={{ marginTop: 12 }}><small>Điểm đã duyệt gần đây: {advisor.recent_scores.map((item) => `${item.score.toFixed(1)} (${new Date(item.reviewed_at).toLocaleDateString('vi-VN')})`).join(' · ')}</small></p>}
        </article>)}
      </div>}
    </section>
  );
}
