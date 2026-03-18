import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sessionManager } from '../application/session_manager';
import { sessionStore } from '../store/session';

export const useSessionList = () => {
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const { sessions, isLoading, filter, currentSessionId } = sessionStore();

  // Load sessions on mount and when filter changes
  useEffect(() => {
    const loadSessions = async () => {
      const searchQuery = searchParams.get('search') || '';
      await sessionManager.loadAllSessions(page, 20);

      // Update filter
      sessionStore.getState().setFilter({
        ...filter,
        search: searchQuery
      });
    };

    loadSessions();
  }, [page, searchParams]);

  // Create new session
  const createNewSession = useCallback(async () => {
    const newSession = await sessionManager.createSession();
    return newSession.id;
  }, []);

  // Load a specific session
  const loadSession = useCallback(async (sessionId: string) => {
    await sessionManager.loadSession(sessionId);
  }, []);

  // Delete session
  // let React Compiler handle this optimization
  const deleteSession = async (sessionId: string) => {
    await sessionManager.deleteSession(sessionId);

    // If deleting current session, clear it
    if (currentSessionId === sessionId) {
      sessionStore.getState().setCurrentSessionId(null);
    }
  };

  // Export session
  const exportSession = useCallback(async (sessionId: string) => {
    try {
      const exportData = await sessionManager.exportSession(sessionId);

      // Create download link
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-${sessionId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error('Failed to export session:', error);
      return false;
    }
  }, []);

  // Filter sessions based on search query
  const filteredSessions = sessions.filter((session) => {
    if (!filter.search) return true;
    return session.title.toLowerCase().includes(filter.search.toLowerCase());
  });

  return {
    sessions: filteredSessions,
    isLoading,
    currentSessionId,
    page,
    setPage,
    createNewSession,
    loadSession,
    deleteSession,
    exportSession
  };
};
