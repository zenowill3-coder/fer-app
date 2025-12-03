import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import SessionWizard from './components/SessionWizard';
import { Session, INITIAL_PERSONA, INITIAL_ROUND1, INITIAL_ROUND2, INITIAL_ROUND3 } from './types';

function App() {
  const [view, setView] = useState<'dashboard' | 'wizard'>('dashboard');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('fers_sessions');
    if (saved) {
        try {
            setSessions(JSON.parse(saved));
        } catch (e) {
            console.error("Failed to load sessions", e);
        }
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    localStorage.setItem('fers_sessions', JSON.stringify(sessions));
  }, [sessions]);

  const handleCreateSession = () => {
    const newSession: Session = {
        id: crypto.randomUUID(),
        name: 'New Session',
        status: 'in-progress',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        persona: { ...INITIAL_PERSONA },
        round1: { ...INITIAL_ROUND1 },
        round2: { ...INITIAL_ROUND2 },
        round3: { ...INITIAL_ROUND3 },
        aiSummary: ''
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setView('wizard');
  };

  const handleContinueSession = (id: string) => {
    setCurrentSessionId(id);
    setView('wizard');
  };

  const handleDeleteSession = (id: string) => {
      if (confirm('确定要删除这个项目吗？')) {
        setSessions(prev => prev.filter(s => s.id !== id));
      }
  };

  const handleUpdateSession = (updatedSession: Session) => {
    setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);

  return (
    <Layout 
        onGoHome={() => setView('dashboard')} 
        title={view === 'wizard' ? '研究进行中' : undefined}
    >
      {view === 'dashboard' && (
        <Dashboard 
            sessions={sessions} 
            onCreateSession={handleCreateSession}
            onContinueSession={handleContinueSession}
            onDeleteSession={handleDeleteSession}
        />
      )}

      {view === 'wizard' && currentSession && (
        <SessionWizard 
            session={currentSession}
            onUpdateSession={handleUpdateSession}
            onComplete={() => {
                setView('dashboard');
            }}
        />
      )}
    </Layout>
  );
}

export default App;