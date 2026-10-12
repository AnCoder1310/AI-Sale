import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScenarioCatalog } from './ScenarioCatalog';
import { PracticeRoom } from './PracticeRoom';
import { EvaluationScorecard } from './EvaluationScorecard';
import { HistoryModal } from './HistoryModal';
import { AdvisorAssignmentsView } from './AdvisorAssignmentsView';
import { practiceApi } from '../../api/practiceApi';
import { ErrorState } from '../common/ErrorState';

export function RoleplayView({ scenarios, scenarioStatus, onRetryScenarios }) {
  const [viewMode, setViewMode] = useState('catalog');
  const [activeScenario, setActiveScenario] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [attemptDetail, setAttemptDetail] = useState(null);
  const [detailStatus, setDetailStatus] = useState('idle');
  const [retryingEvaluation, setRetryingEvaluation] = useState(false);
  const [retryEvaluationError, setRetryEvaluationError] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyStatus, setHistoryStatus] = useState('loading');
  const [historyError, setHistoryError] = useState('');
  const [historyScenarioId, setHistoryScenarioId] = useState(null);
  const [startError, setStartError] = useState('');
  const [starting, setStarting] = useState(false);
  const [lastMaxTurns, setLastMaxTurns] = useState(10);
  const [assignmentReloadToken, setAssignmentReloadToken] = useState(0);

  const loadHistory = useCallback(async () => {
    setHistoryStatus('loading');
    setHistoryError('');
    try {
      setHistory(await practiceApi.getHistory());
      setHistoryStatus('ready');
    } catch (error) {
      setHistoryError(error.message || 'Vui lòng thử lại.');
      setHistoryStatus('error');
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    practiceApi.getHistory().then((items) => {
      if (mounted) {
        setHistory(items);
        setHistoryStatus('ready');
      }
    }).catch((error) => {
      if (mounted) {
        setHistoryError(error.message || 'Vui lòng thử lại.');
        setHistoryStatus('error');
      }
    });
    return () => { mounted = false; };
  }, []);

  const latestByScenario = useMemo(() => {
    const latest = {};
    for (const attempt of history) {
      if (!latest[attempt.scenario_id]) latest[attempt.scenario_id] = attempt;
    }
    return latest;
  }, [history]);

  const handleStartScenario = async (scenarioId, maxTurns = 10, assignmentId = null) => {
    const scen = scenarios.find((s) => s.scenario_id === scenarioId);
    if (!scen || starting) return;
    setActiveScenario(scen);
    setStartError('');
    setStarting(true);
    setLastMaxTurns(maxTurns);
    try {
      const sessionView = await practiceApi.startSession(scen.scenario_id, maxTurns, assignmentId);
      setActiveSession(sessionView);
      setViewMode('room');
    } catch (error) {
      setStartError(error.message || 'Không thể bắt đầu phiên. Vui lòng thử lại.');
    } finally {
      setStarting(false);
    }
  };

  const handleFinishSession = (resultView) => {
    setEvaluationResult(resultView);
    setAttemptDetail(null);
    setViewMode('evaluation');
    loadHistory();
    setAssignmentReloadToken((value) => value + 1);
  };

  const handleBackToCatalog = () => {
    setViewMode('catalog');
    setActiveSession(null);
    setEvaluationResult(null);
    setAttemptDetail(null);
    loadHistory();
    setAssignmentReloadToken((value) => value + 1);
  };

  const openAttempt = async (sessionId) => {
    setRetryEvaluationError('');
    setHistoryScenarioId(null);
    setSelectedSessionId(sessionId);
    setDetailStatus('loading');
    setViewMode('attempt');
    try {
      const detail = await practiceApi.getAttempt(sessionId);
      setAttemptDetail(detail);
      setActiveScenario(scenarios.find((s) => s.scenario_id === detail.attempt.scenario_id) || null);
      setDetailStatus('ready');
    } catch (error) {
      setStartError(error.message || 'Không tải được phiên luyện tập.');
      setDetailStatus('error');
    }
  };

  const retryFailedEvaluation = async () => {
    if (!attemptDetail || retryingEvaluation) return;
    setRetryingEvaluation(true);
    setRetryEvaluationError('');
    try {
      await practiceApi.finishSession(attemptDetail.attempt.session_id);
      setAttemptDetail(await practiceApi.getAttempt(attemptDetail.attempt.session_id));
      await loadHistory();
    } catch (error) {
      setRetryEvaluationError(error.message || 'Chưa thể chấm điểm lại. Hãy thử lại sau.');
    } finally {
      setRetryingEvaluation(false);
    }
  };

  const visibleHistory = historyScenarioId ? history.filter((item) => item.scenario_id === historyScenarioId) : history;

  return (
    <div>
      {scenarioStatus === 'loading' && <p>Đang tải tình huống từ backend...</p>}
      {scenarioStatus === 'error' && <ErrorState message="Không tải được tình huống từ backend." onRetry={onRetryScenarios} />}
      {viewMode === 'catalog' && startError && <ErrorState message={startError} onRetry={() => handleStartScenario(activeScenario?.scenario_id, lastMaxTurns)} />}
      {viewMode === 'catalog' && (
        <>
          <AdvisorAssignmentsView
            scenarios={scenarios}
            reloadToken={assignmentReloadToken}
            onStart={(assignment) => handleStartScenario(assignment.scenario_id, 10, assignment.assignment_id)}
            onOpenAttempt={openAttempt}
          />
          {historyStatus === 'loading' && <p>Đang tải kết quả gần nhất...</p>}
          {historyStatus === 'error' && <ErrorState message={`Không tải được lịch sử: ${historyError}`} onRetry={loadHistory} />}
          <ScenarioCatalog
            scenarios={scenarios}
            onStartScenario={handleStartScenario}
            onOpenHistory={setHistoryScenarioId}
            latestByScenario={latestByScenario}
            starting={starting}
          />
        </>
      )}
      {viewMode === 'room' && (
        <PracticeRoom scenario={activeScenario} session={activeSession} onFinish={handleFinishSession} onSavedAttempt={openAttempt} onExit={handleBackToCatalog} />
      )}
      {viewMode === 'evaluation' && (
        <EvaluationScorecard result={evaluationResult} scenario={activeScenario} onRetry={() => handleStartScenario(activeScenario?.scenario_id, lastMaxTurns)} onBackToCatalog={handleBackToCatalog} />
      )}
      {viewMode === 'attempt' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <button className="btn-ghost" onClick={handleBackToCatalog}>← Về danh sách tình huống</button>
          {detailStatus === 'loading' && <p>Đang tải phiên luyện tập...</p>}
          {detailStatus === 'error' && <ErrorState message={startError} onRetry={() => openAttempt(selectedSessionId)} />}
          {detailStatus === 'ready' && attemptDetail && (
            <>
              <section className="card-white">
                <h2>Hội thoại đã lưu</h2>
                {(attemptDetail.session.messages || []).map((message) => (
                  <p key={message.message_id} id={`message-${message.message_id}`} style={{ whiteSpace: 'pre-wrap', padding: 8 }}>
                    <strong>{message.role === 'advisor' ? 'Tư vấn viên' : 'Khách hàng'}:</strong> {message.content}
                  </p>
                ))}
              </section>
              {attemptDetail.attempt.evaluation_status === 'failed' ? (
                <div role="alert" className="card-white">
                  <p>Phiên này đã lưu nhưng chấm điểm thất bại.</p>
                  <button className="btn-primary" onClick={retryFailedEvaluation} disabled={retryingEvaluation}>
                    {retryingEvaluation ? 'Đang chấm điểm lại...' : 'Thử chấm điểm lại'}
                  </button>
                  {retryEvaluationError && <p role="alert">{retryEvaluationError}</p>}
                </div>
              ) : (
                <EvaluationScorecard
                  result={{ ...attemptDetail.ai_evaluation, result: attemptDetail.manager_review?.approved_result || attemptDetail.ai_evaluation.result }}
                  scenario={activeScenario}
                  onRetry={() => handleStartScenario(attemptDetail.attempt.scenario_id, lastMaxTurns)}
                  onBackToCatalog={handleBackToCatalog}
                />
              )}
            </>
          )}
        </div>
      )}
      <HistoryModal
        isOpen={historyScenarioId !== null}
        onClose={() => setHistoryScenarioId(null)}
        attempts={visibleHistory}
        status={historyStatus}
        error={historyError}
        onRetry={loadHistory}
        onSelectSession={openAttempt}
      />
    </div>
  );
}
