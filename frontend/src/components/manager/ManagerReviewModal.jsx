import { useMemo, useState } from 'react';

const CRITERION_LABELS = {
  need_discovery: 'Khám phá nhu cầu',
  product_knowledge: 'Kiến thức sản phẩm',
  objection_handling: 'Xử lý phản đối',
  policy_accuracy: 'Độ chính xác chính sách',
  closing_next_step: 'Chốt bước tiếp theo',
};

function ScoreEditor({ evaluation, value, onChange }) {
  const assessed = evaluation.status === 'assessed';
  return (
    <article className="review-criterion">
      <div className="review-criterion-heading">
        <div>
          <strong>{CRITERION_LABELS[evaluation.criterion] || evaluation.criterion}</strong>
          <span>{assessed ? 'Đã đánh giá' : 'Chưa đủ bằng chứng'}</span>
        </div>
        {assessed && (
          <label>
            <span className="sr-only">Điểm quản lý</span>
            <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
              {[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score}/5</option>)}
            </select>
          </label>
        )}
      </div>
      <p>{evaluation.reason}</p>
      {evaluation.improvement_suggestion && <p className="review-improvement">↗ {evaluation.improvement_suggestion}</p>}
      {evaluation.evidence.length > 0 && (
        <div className="review-evidence-list">
          {evaluation.evidence.map((evidence) => (
            <blockquote key={`${evaluation.criterion}-${evidence.message_id}`}>
              “{evidence.quote}” <cite>{evidence.message_id}</cite>
            </blockquote>
          ))}
        </div>
      )}
    </article>
  );
}

export function ManagerReviewModal({ detail, onClose, onApprove }) {
  const draft = detail.ai_evaluation.result;
  const [scores, setScores] = useState(() => Object.fromEntries(
    (draft?.evaluations || [])
      .filter((item) => item.status === 'assessed')
      .map((item) => [item.criterion, item.score]),
  ));
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const messagesById = useMemo(
    () => Object.fromEntries(detail.session.messages.map((message) => [message.message_id, message])),
    [detail.session.messages],
  );

  const submit = async (event) => {
    event.preventDefault();
    if (!reason.trim()) {
      setError('Vui lòng ghi lý do xác nhận hoặc điều chỉnh đánh giá.');
      return;
    }
    const overrides = Object.fromEntries(
      (draft?.evaluations || [])
        .filter((item) => item.status === 'assessed' && scores[item.criterion] !== item.score)
        .map((item) => [item.criterion, scores[item.criterion]]),
    );
    setStatus('saving');
    setError('');
    try {
      await onApprove({ score_overrides: overrides, change_reason: reason.trim() });
    } catch (approvalError) {
      setStatus('idle');
      setError(approvalError.message || 'Không thể lưu đánh giá. Vui lòng thử lại.');
    }
  };

  return (
    <div className="review-modal-backdrop" role="presentation">
      <section className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-dialog-title">
        <header className="review-modal-header">
          <div>
            <span>◇ Human-in-the-Loop Review</span>
            <h2 id="review-dialog-title">Thẩm định kết quả AI</h2>
            <p>Advisor: {detail.attempt.advisor_id} · Scenario: {detail.attempt.scenario_id}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng cửa sổ đánh giá">×</button>
        </header>

        <form onSubmit={submit} className="review-modal-body">
          <div className="review-detail-column">
            <section className="review-summary-card">
              <div>
                <span>AI draft score</span>
                <strong>{draft?.overall_score?.toFixed(1) || '—'}<small>/5</small></strong>
              </div>
              <div>
                <span>Rubric version</span>
                <strong className="review-version">{draft?.rubric_version || '—'}</strong>
              </div>
            </section>

            <section>
              <h3>Transcript</h3>
              <div className="review-transcript">
                {detail.session.messages.length === 0 && <p>Phiên này chưa có transcript.</p>}
                {detail.session.messages.map((message) => (
                  <div key={message.message_id} className={`review-message ${message.role}`}>
                    <span>{message.role === 'advisor' ? 'Tư vấn viên' : 'AI Customer'}</span>
                    <p>{message.content}</p>
                    <small>{message.message_id}</small>
                  </div>
                ))}
              </div>
            </section>

            {draft?.factual_findings?.length > 0 && (
              <section>
                <h3>Đối chiếu thông tin thực tế</h3>
                <div className="review-findings">
                  {draft.factual_findings.map((finding) => (
                    <article key={`${finding.message_id}-${finding.claim}`}>
                      <strong>{finding.status}</strong>
                      <p>“{finding.claim}”</p>
                      <span>{finding.reason}</span>
                      {messagesById[finding.message_id] && <small>Nguồn transcript: {finding.message_id}</small>}
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="review-score-column">
            <div className="review-section-heading">
              <div>
                <h3>Điểm theo rubric</h3>
                <p>Chỉ tiêu chí đã có evidence mới được điều chỉnh.</p>
              </div>
              <span>{Object.values(scores).length} tiêu chí</span>
            </div>
            <div className="review-criteria-list">
              {draft?.evaluations.map((evaluation) => (
                <ScoreEditor
                  key={evaluation.criterion}
                  evaluation={evaluation}
                  value={scores[evaluation.criterion] ?? evaluation.score ?? ''}
                  onChange={(score) => setScores((current) => ({ ...current, [evaluation.criterion]: score }))}
                />
              ))}
            </div>

            <label className="review-reason-field">
              <span>Lý do xác nhận/điều chỉnh <strong>*</strong></span>
              <textarea
                rows="4"
                maxLength="2000"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ví dụ: Điểm phù hợp với transcript và evidence; xác nhận AI draft."
                disabled={status === 'saving' || status === 'saved'}
              />
            </label>
            {error && <div className="review-error" role="alert">{error}</div>}

            <footer className="review-modal-actions">
              <button type="button" className="review-secondary" onClick={onClose}>Hủy</button>
              <button type="submit" className="review-approve" disabled={status !== 'idle'}>
                {status === 'saving' ? 'Đang lưu…' : '✓ Phê duyệt & lưu'}
              </button>
            </footer>
          </div>
        </form>
      </section>
    </div>
  );
}
