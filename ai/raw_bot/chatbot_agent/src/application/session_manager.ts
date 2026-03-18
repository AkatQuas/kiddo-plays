import { v4 as uuidv4 } from 'uuid';
import { indexedDBPersistence } from '../persistence/indexed_db';
import { localStoragePersistence } from '../persistence/local_storage';
import { chatStore } from '../store/chat';
import { sessionStore } from '../store/session';
import type { Session } from '../types/session';

export const sessionManager = {
  // Create a new session
  async createSession(initialTitle = 'New Conversation'): Promise<Session> {
    const session: Session = {
      id: uuidv4(),
      title: initialTitle,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0
    };

    // Update stores
    sessionStore.getState().addSession(session);
    sessionStore.getState().setCurrentSessionId(session.id);
    chatStore.getState().setCurrentSessionId(session.id);

    // Persist session metadata
    await localStoragePersistence.write(`session_${session.id}`, session);

    return session;
  },

  // Load a session by ID
  async loadSession(sessionId: string): Promise<Session | null> {
    sessionStore.getState().setIsLoading(true);

    try {
      // Load session metadata
      const session = await localStoragePersistence.read<Session>(
        `session_${sessionId}`
      );
      if (!session) return null;

      // Load messages (paginated)
      // TODO: Implement paginated message loading
      // const messages = await indexedDBPersistence.read(`messages_${sessionId}`, 1, 50);

      // Update stores
      sessionStore.getState().setCurrentSessionId(sessionId);
      chatStore.getState().setCurrentSessionId(sessionId);
      // if (messages) chatStore.getState().setMessages(sessionId, messages as Message[]);

      return session;
    } catch (error) {
      console.error('Failed to load session:', error);
      return null;
    } finally {
      sessionStore.getState().setIsLoading(false);
    }
  },

  // Update session metadata
  async updateSession(
    sessionId: string,
    updates: Partial<Session>
  ): Promise<void> {
    const session = await localStoragePersistence.read<Session>(
      `session_${sessionId}`
    );
    if (!session) return;

    const updatedSession = { ...session, ...updates, updatedAt: Date.now() };

    // Update store
    sessionStore.getState().updateSession(sessionId, updatedSession);

    // Persist changes
    await localStoragePersistence.write(`session_${sessionId}`, updatedSession);
  },

  // Delete a session
  async deleteSession(sessionId: string): Promise<void> {
    // Update stores
    sessionStore.getState().deleteSession(sessionId);
    if (sessionStore.getState().currentSessionId === sessionId) {
      sessionStore.getState().setCurrentSessionId(null);
      chatStore.getState().setCurrentSessionId(null);
    }

    // Delete from persistence
    await localStoragePersistence.delete(`session_${sessionId}`);
    await indexedDBPersistence.delete(`messages_${sessionId}`);
  },

  // Load all sessions (paginated)
  async loadAllSessions(page = 1, pageSize = 20): Promise<Session[]> {
    sessionStore.getState().setIsLoading(true);

    try {
      // Get all session keys
      const sessionKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('session_')) {
          sessionKeys.push(key);
        }
      }

      // Paginate
      const paginatedKeys = sessionKeys.slice(
        (page - 1) * pageSize,
        page * pageSize
      );

      // Load sessions
      const sessions = await Promise.all(
        paginatedKeys.map((key) => localStoragePersistence.read<Session>(key))
      );

      const validSessions = sessions.filter((s): s is Session => s !== null);

      // Sort by updated time (newest first)
      validSessions.sort((a, b) => b.updatedAt - a.updatedAt);

      // Update store
      sessionStore.getState().setSessions(validSessions);

      return validSessions;
    } catch (error) {
      console.error('Failed to load sessions:', error);
      return [];
    } finally {
      sessionStore.getState().setIsLoading(false);
    }
  },

  // Export session data
  async exportSession(sessionId: string): Promise<string> {
    const session = await localStoragePersistence.read<Session>(
      `session_${sessionId}`
    );
    // const messages = await indexedDBPersistence.read(`messages_${sessionId}`);

    if (!session) {
      throw new Error('Session not found');
    }

    const exportData = {
      session
      // messages: messages || [],
    };

    return JSON.stringify(exportData, null, 2);
  },

  // Generate session title from initial message
  generateSessionTitle(message: string): string {
    // Use first 30 characters or full message if shorter
    const title =
      message.length > 30 ? `${message.substring(0, 30)}...` : message;
    return title || 'New Conversation';
  }
};
