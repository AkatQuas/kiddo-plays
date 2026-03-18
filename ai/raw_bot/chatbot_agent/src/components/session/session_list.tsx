import { DownloadIcon, TrashIcon } from '@radix-ui/react-icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionList } from '../../hooks/use_session_list';
import { Button } from '../common/button';
import { Card } from '../common/card';
import { Input } from '../common/input';

export const SessionList = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const {
    sessions,
    isLoading,
    currentSessionId,
    createNewSession,
    loadSession,
    deleteSession,
    exportSession
  } = useSessionList();

  const handleCreateNewSession = async () => {
    const sessionId = await createNewSession();
    navigate(`/chat/${sessionId}`);
  };

  const handleSessionClick = async (sessionId: string) => {
    await loadSession(sessionId);
    navigate(`/chat/${sessionId}`);
  };

  const handleDeleteSession = async (
    e: React.MouseEvent,
    sessionId: string
  ) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this session?')) {
      await deleteSession(sessionId);
      if (currentSessionId === sessionId) {
        navigate('/');
      }
    }
  };

  const handleExportSession = async (
    e: React.MouseEvent,
    sessionId: string
  ) => {
    e.stopPropagation();
    await exportSession(sessionId);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse bg-muted rounded-md p-4 h-16"
          ></div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* New session button */}
      <div className="p-4">
        <Button onClick={handleCreateNewSession} className="w-full">
          New Conversation
        </Button>
      </div>

      {/* Search */}
      <div className="px-4 mb-2">
        <Input
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-muted"
        />
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-auto p-2">
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No conversations yet. Start a new one!
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((session) => (
              <Card
                key={session.id}
                className={`cursor-pointer hover:bg-accent/20 transition-colors ${
                  currentSessionId === session.id
                    ? 'bg-accent/10 border-primary'
                    : ''
                }`}
                onClick={() => handleSessionClick(session.id)}
              >
                <div className="p-3 flex flex-col">
                  <div className="flex justify-between items-start">
                    <h3 className="font-medium truncate">{session.title}</h3>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => handleExportSession(e, session.id)}
                      >
                        <DownloadIcon className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive/80"
                        onClick={(e) => handleDeleteSession(e, session.id)}
                      >
                        <TrashIcon className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-1 text-xs text-muted-foreground">
                    <span>{formatDate(session.updatedAt)}</span>
                    <span>{session.messageCount} messages</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
