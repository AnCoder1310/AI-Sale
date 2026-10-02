import { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { NotificationDrawer } from './components/layout/NotificationDrawer';
import { HomeView } from './components/home/HomeView';
import { CopilotView } from './components/copilot/CopilotView';
import { RoleplayView } from './components/roleplay/RoleplayView';
import { KnowledgeView } from './components/knowledge/KnowledgeView';
import { ChargingView } from './components/charging/ChargingView';
import { ProgressView } from './components/progress/ProgressView';

import { SCENARIO_PRESETS } from './data/scenarioData';
import { ADVISOR_PROFILE, RUBRIC_CRITERIA, INITIAL_NOTIFICATIONS } from './data/competencyData';
import { practiceApi } from './api/practiceApi';

export function App() {
  const [currentTab, setCurrentTab] = useState('home');
  const [scenarios, setScenarios] = useState(SCENARIO_PRESETS);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [copilotQuery, setCopilotQuery] = useState('');

  // Fetch real scenarios from backend on load
  useEffect(() => {
    async function loadBackendScenarios() {
      try {
        const backendList = await practiceApi.getScenarios();
        if (Array.isArray(backendList) && backendList.length > 0) {
          // Merge backend scenarios with our rich presentation metadata
          const merged = SCENARIO_PRESETS.map((preset) => {
            const match = backendList.find((b) => b.scenario_id === preset.scenario_id);
            if (match) {
              return {
                ...preset,
                title: match.title || preset.title,
                difficulty: match.difficulty || preset.difficulty,
                sales_channel: match.sales_channel || preset.sales_channel,
                training_objective: match.training_objective || preset.training_objective,
                target_skills: match.target_skills || preset.target_skills,
                visible_context: match.visible_context || preset.visible_context,
                max_turns: match.max_turns || 8,
                is_backend: true,
              };
            }
            return preset;
          });
          setScenarios(merged);
        }
      } catch {
        // Retain preset catalog if backend is not immediately responding
      }
    }
    loadBackendScenarios();
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleSelectNotification = (item) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );
    if (item.link) {
      setCurrentTab(item.link);
    }
  };

  const handleStartScenarioFromHome = () => {
    setCurrentTab('roleplay');
  };

  const handleConsultCopilot = (query) => {
    setCopilotQuery(query);
    setCurrentTab('copilot');
  };

  return (
    <div className="app-container">
      {/* GLOBAL TOP HEADER */}
      <Header
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        unreadCount={unreadCount}
        onOpenNotifications={() => setIsNotifOpen(true)}
        advisorProfile={ADVISOR_PROFILE}
      />

      {/* MAIN CONTENT AREA */}
      <main className="main-content">
        {currentTab === 'home' && (
          <HomeView
            advisorProfile={ADVISOR_PROFILE}
            scenarios={scenarios}
            rubricCriteria={RUBRIC_CRITERIA}
            onNavigate={(tab) => setCurrentTab(tab)}
            onStartScenario={handleStartScenarioFromHome}
          />
        )}

        {currentTab === 'copilot' && (
          <CopilotView
            initialQuery={copilotQuery}
            onOpenDocument={() => {
              setCurrentTab('knowledge');
            }}
          />
        )}

        {currentTab === 'roleplay' && (
          <RoleplayView scenarios={scenarios} />
        )}

        {currentTab === 'knowledge' && (
          <KnowledgeView
            onOpenCopilotQuery={handleConsultCopilot}
          />
        )}

        {currentTab === 'charging' && (
          <ChargingView
            onConsultCopilot={handleConsultCopilot}
          />
        )}

        {currentTab === 'progress' && (
          <ProgressView
            advisorProfile={ADVISOR_PROFILE}
            rubricCriteria={RUBRIC_CRITERIA}
            onNavigateToRoleplay={() => setCurrentTab('roleplay')}
          />
        )}
      </main>

      {/* NOTIFICATIONS FLYOUT */}
      <NotificationDrawer
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllRead}
        onSelectNotification={handleSelectNotification}
      />
    </div>
  );
}

export default App;
