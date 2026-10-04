import { useCallback, useEffect, useState } from 'react';
import { managerApi } from '../../api/managerApi';

const LABELS = {
  need_discovery: 'Khám phá nhu cầu',
  product_knowledge: 'Kiến thức sản phẩm',
  objection_handling: 'Xử lý phản đối',
  policy_accuracy: 'Độ chính xác chính sách',
  closing_next_step: 'Chốt bước tiếp theo',
};

export function TeamOverviewView() {
  const [overview, setOverview] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      setOverview(await managerApi.getTeamOverview());
      setStatus('ready');
    } catch (loadError) {
      setError(loadError.message || 'Không thể tải tổng quan đội ngũ.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let active = true;
    managerApi.getTeamOverview()
      .then((result) => {
        if (!active) return;
        setOverview(result);
        setStatus('ready');
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError.message || 'Không thể tải tổng quan đội ngũ.');
        setStatus('error');
      });
    return () => { active = false; };
  }, []);

  return (
    <section className="manager-queue-card">
      <div className="manager-queue-heading">
        <div><h2>Tổng quan đội ngũ</h2><p>Số liệu từ attempt đã lưu. Điểm kỹ năng chỉ tính các bài đã được manager duyệt.</p></div>
        <button type="button" onClick={load} disabled={status === 'loading'}>↻ Tải lại</button>
      </div>
      {status === 'loading' && <div className="manager-queue-state" role="status">Đang tải số liệu…</div>}
      {status === 'error' && <div className="manager-queue-error" role="alert">{error} <button type="button" onClick={load}>Thử lại</button></div>}
      {status === 'ready' && overview && (
        <>
          <div className="manager-metrics">
            <article><strong>{overview.completed_attempts}</strong><span>Attempt hoàn thành</span></article>
            <article><strong>{overview.approved_attempts}</strong><span>Đã duyệt</span></article>
            <article><strong>{overview.pending_attempts}</strong><span>Còn chờ duyệt</span></article>
            <article><strong>{overview.active_advisors}</strong><span>Tư vấn viên đã luyện</span></article>
          </div>
          {overview.failed_evaluations > 0 && <p className="manager-metric-note">{overview.failed_evaluations} attempt chấm điểm lỗi cần retry; không tính vào điểm kỹ năng.</p>}
          <h3 className="manager-skill-heading">Điểm kỹ năng đã duyệt</h3>
          {overview.skill_summaries.length === 0 ? (
            <div className="manager-queue-state">Chưa có kết quả được duyệt để tính điểm đội ngũ.</div>
          ) : (
            <div className="manager-skill-list">
              {overview.skill_summaries.map((skill) => (
                <div key={skill.criterion} className="manager-skill-row">
                  <span>{LABELS[skill.criterion] || skill.criterion}</span>
                  <strong>{skill.average_score.toFixed(1)}/3</strong>
                  <small>{skill.assessed_count} bài đã chấm</small>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
