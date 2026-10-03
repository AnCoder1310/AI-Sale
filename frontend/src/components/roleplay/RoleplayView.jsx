import { useState } from 'react';
import { ScenarioCatalog } from './ScenarioCatalog';
import { PracticeRoom } from './PracticeRoom';
import { EvaluationScorecard } from './EvaluationScorecard';
import { practiceApi } from '../../api/practiceApi';
import { ErrorState } from '../common/ErrorState';

export function RoleplayView({ scenarios, scenarioStatus, onRetryScenarios }) {
  const [viewMode, setViewMode] = useState('catalog'); // 'catalog' | 'room' | 'evaluation'
  const [activeScenario, setActiveScenario] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [startError, setStartError] = useState('');
  const [starting, setStarting] = useState(false);

  const handleStartScenario = async (scenarioId) => {
    const scen = scenarios.find((s) => s.scenario_id === scenarioId);
    if (!scen || starting) return;
    setActiveScenario(scen);
    setStartError('');
    setStarting(true);
    try {
      const sessionView = await practiceApi.startSession(scen.scenario_id);
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
    setViewMode('evaluation');

  };

  const handleRetry = () => {
    if (activeScenario) {
      handleStartScenario(activeScenario.scenario_id);
    }
  };

  const handleBackToCatalog = () => {
    setViewMode('catalog');
    setActiveSession(null);
    setEvaluationResult(null);
  };

  return (
    <div>
      {scenarioStatus === 'loading' && <p>Đang tải tình huống từ backend...</p>}
      {scenarioStatus === 'error' && <ErrorState message="Không tải được tình huống từ backend." onRetry={onRetryScenarios} />}
      {startError && <ErrorState message={startError} onRetry={() => handleStartScenario(activeScenario?.scenario_id)} />}
      {viewMode === 'catalog' && (
        <ScenarioCatalog
          scenarios={scenarios}
          onStartScenario={handleStartScenario}
          starting={starting}
        />
      )}

      {viewMode === 'room' && (
        <PracticeRoom
          scenario={activeScenario}
          session={activeSession}
          onFinish={handleFinishSession}
          onExit={handleBackToCatalog}
        />
      )}

      {viewMode === 'evaluation' && (
        <EvaluationScorecard
          result={evaluationResult}
          scenario={activeScenario}
          onRetry={handleRetry}
          onBackToCatalog={handleBackToCatalog}
        />
      )}

    </div>
  );
}
