import { useState } from 'react';
import { ScenarioCatalog } from './ScenarioCatalog';
import { PracticeRoom } from './PracticeRoom';
import { EvaluationScorecard } from './EvaluationScorecard';
import { HistoryModal } from './HistoryModal';
import { practiceApi } from '../../api/practiceApi';
import { createId } from '../../lib/id';

export function RoleplayView({ scenarios }) {
  const [viewMode, setViewMode] = useState('catalog'); // 'catalog' | 'room' | 'evaluation'
  const [activeScenario, setActiveScenario] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyList, setHistoryList] = useState([
    {
      id: 'hist-1',
      title: 'VF 7 — So sánh trực diện ADAS & Vận hành với C-SUV Máy Xăng',
      model: 'VF 7',
      customer: 'Chị Phương Lan (Giám đốc Truyền thông)',
      time: 'Hôm nay • 09:15',
      duration: '14 phút',
      score: 86.0,
      passed: true,
    },
    {
      id: 'hist-2',
      title: 'Bác tài chạy dịch vụ cân nhắc đổi từ xe xăng sang VF 5 Plus',
      model: 'VF 5',
      customer: 'Anh Nam (Tài xế công nghệ)',
      time: 'Hôm qua • 14:05',
      duration: '12 phút',
      score: 92.0,
      passed: true,
    },
    {
      id: 'hist-3',
      title: 'VF 6 — Khách hàng mua xe lần đầu cân nhắc bài toán kinh tế',
      model: 'VF 6',
      customer: 'Anh Tuấn (Kỹ sư xây dựng)',
      time: '2 ngày trước',
      duration: '10 phút',
      score: 79.5,
      passed: false,
    },
  ]);

  const handleStartScenario = async (scenarioId) => {
    const scen = scenarios.find((s) => s.scenario_id === scenarioId) || scenarios[0];
    setActiveScenario(scen);

    try {
      if (scen.is_backend) {
        const sessionView = await practiceApi.startSession(scen.scenario_id);
        setActiveSession(sessionView);
      } else {
        setActiveSession({
          session_id: createId('sess'),
          scenario_id: scen.scenario_id,
          difficulty: scen.difficulty,
          turn_count: 0,
          conversation_stage: 'opening',
          messages: [],
        });
      }
      setViewMode('room');
    } catch {
      // Graceful fallback to client room if backend offline
      setActiveSession({
        session_id: createId('sess-local'),
        scenario_id: scen.scenario_id,
        difficulty: scen.difficulty,
        turn_count: 0,
        conversation_stage: 'opening',
        messages: [],
      });
      setViewMode('room');
    }
  };

  const handleFinishSession = (resultView) => {
    setEvaluationResult(resultView);
    setViewMode('evaluation');

    if (resultView?.result) {
      const overall100 = Math.round(((resultView.result.overall_score || 4.2) / 5) * 100);
      const newHistoryItem = {
        id: createId('hist'),
        title: activeScenario?.title || 'Phiên thực chiến',
        model: activeScenario?.model || 'VF',
        customer: activeScenario?.persona?.name || 'Khách hàng',
        time: 'Vừa xong',
        duration: '15 phút',
        score: overall100,
        passed: resultView.result.passed ?? true,
      };
      setHistoryList((prev) => [newHistoryItem, ...prev]);
    }
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
      {viewMode === 'catalog' && (
        <ScenarioCatalog
          scenarios={scenarios}
          onStartScenario={handleStartScenario}
          onOpenHistory={() => setShowHistoryModal(true)}
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

      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        historyList={historyList}
        onSelectSession={(item) => {
          alert(`Đang xem phiên: ${item.title} - Điểm: ${item.score}/100`);
        }}
      />
    </div>
  );
}
