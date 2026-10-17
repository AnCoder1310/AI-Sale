import { CRITERIA, fmtDelta, fmtScore, sparkPoints } from '../../utils/scoreFormat';
import './advisorProgress.css';

function changeLine(change) {
  if (change == null) return null;
  const rounded = Math.round(change * 10) / 10;
  if (rounded === 0) return 'Giữ nguyên so với 8 tuần trước';
  return `${rounded > 0 ? 'Tăng' : 'Giảm'} ${fmtScore(Math.abs(rounded))} điểm so với 8 tuần trước`;
}

export function AdvisorProgress({ progress }) {
  const { status, data, error, reload } = progress;
  return (
    <section className="ap-card ap-progress" aria-labelledby="ap-score-h">
      {status === 'loading' && <p className="ap-state" role="status">Đang tải tiến độ của bạn…</p>}
      {status === 'error' && (
        <p className="ap-state ap-state--error" role="alert">
          {error || 'Không tải được tiến độ.'} <button type="button" className="ap-link" onClick={reload}>Thử lại</button>
        </p>
      )}
      {status === 'ready' && data && data.approved_sessions === 0 && (
        <div className="ap-empty">
          <h2 id="ap-score-h">Điểm của bạn</h2>
          <p className="ap-state">Chưa có bài nào được quản lý duyệt. Hoàn thành một tình huống bên dưới, điểm sẽ hiện ở đây sau khi được duyệt.</p>
        </div>
      )}
      {status === 'ready' && data && data.approved_sessions > 0 && <ProgressBody data={data} />}
    </section>
  );
}

function ProgressBody({ data }) {
  const trend = data.trend || [];
  const values = trend.map((item) => item.avg_score);
  const runs = sparkPoints(values, 280, 70, 4);
  const filled = values.filter((value) => value != null);
  const lastPoint = runs.flat().slice(-1)[0];
  const headline = data.current_week_avg ?? data.overall_avg;
  const change = changeLine(data.change_8w);
  return (
    <>
      <div className="ap-score">
        <h2 id="ap-score-h">Điểm của bạn</h2>
        <div className="ap-score-value">
          <strong>{fmtScore(headline)}</strong>
          <span>{data.current_week_avg != null ? '/ 3 ở tuần này' : '/ 3 trung bình'}</span>
        </div>
        {change && <p className="ap-change">{change}</p>}
        {filled.length > 0 && (
          <svg
            role="img"
            aria-label={`Điểm theo tuần: ${filled.map((value) => fmtScore(value)).join('; ')}`}
            viewBox="0 0 280 70"
            className="ap-spark"
          >
            <line x1="0" y1="35" x2="280" y2="35" className="ap-spark-ref" />
            {runs.map((run) => (
              run.length > 1 ? <polyline key={`${run[0].x}-${run.length}`} fill="none" points={run.map((point) => `${point.x},${point.y}`).join(' ')} /> : null
            ))}
            {lastPoint && <circle cx={lastPoint.x} cy={lastPoint.y} r="5" />}
          </svg>
        )}
        <span className="ap-caption">{trend.length} tuần, đường gạch là mức 2 (chuẩn chuyên nghiệp)</span>
      </div>

      <div className="ap-skills">
        <h2>Từng kỹ năng</h2>
        <ul>
          {CRITERIA.map((criterion) => {
            const item = data.criteria?.[criterion.key] || {};
            const value = item.latest_avg;
            return (
              <li key={criterion.key}>
                <span>{criterion.label}</span>
                <span className="ap-track" aria-hidden="true">
                  <span className={value != null && value >= 2.5 ? 'ap-fill ap-fill--strong' : 'ap-fill'} style={{ width: `${value == null ? 0 : Math.round((value / 3) * 100)}%` }} />
                  <span className="ap-mid" />
                </span>
                <strong>{fmtScore(value)}</strong>
                <span className={item.change_4w != null && item.change_4w < 0 ? 'ap-delta ap-delta--down' : 'ap-delta'}>{fmtDelta(item.change_4w)}</span>
              </li>
            );
          })}
        </ul>
        <p className="ap-foot">Vạch giữa là mức 2. Cột cuối là thay đổi so với 4 tuần trước.</p>
      </div>
    </>
  );
}
