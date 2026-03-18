import { create } from 'zustand';
import type { Session, SessionFilter } from '../types/session';

type SessionState = {
  sessions: Session[];
  currentSessionId: string | null;
  isLoading: boolean;
  filter: SessionFilter;

  // Actions
  addSession: (session: Session) => void;
  updateSession: (sessionId: string, updates: Partial<Session>) => void;
  deleteSession: (sessionId: string) => void;
  setSessions: (sessions: Session[]) => void;
  setCurrentSessionId: (sessionId: string | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setFilter: (filter: SessionFilter) => void;
  clearSessions: () => void;
};

export const sessionStore = create<SessionState>((set) => ({
  sessions: [],
  currentSessionId: null,
  isLoading: false,
  filter: {},

  addSession: (session) =>
    set((state) => ({
      sessions: [...state.sessions, session]
    })),

  updateSession: (sessionId, updates) =>
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === sessionId
          ? { ...session, ...updates, updatedAt: Date.now() }
          : session
      )
    })),

  deleteSession: (sessionId) =>
    set((state) => ({
      sessions: state.sessions.filter((session) => session.id !== sessionId)
    })),

  setSessions: (sessions) => set({ sessions }),
  setCurrentSessionId: (sessionId) => set({ currentSessionId: sessionId }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setFilter: (filter) => set({ filter }),
  clearSessions: () => set({ sessions: [] })
}));
