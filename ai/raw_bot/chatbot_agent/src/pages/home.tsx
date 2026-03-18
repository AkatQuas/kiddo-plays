import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/common/button';
import { useSessionList } from '../hooks/use_session_list';
import { configStore } from '../store/config';

export const Home = () => {
  const navigate = useNavigate();
  const { hasConfig, isLoading } = configStore();
  const { sessions, createNewSession } = useSessionList();

  // Redirect to config if no API key configured
  useEffect(() => {
    if (!isLoading && !hasConfig) {
      navigate('/config');
    }
  }, [hasConfig, isLoading, navigate]);

  // Redirect to first session if exists
  useEffect(() => {
    if (!isLoading && hasConfig && sessions.length > 0) {
      navigate(`/chat/${sessions[0].id}`);
    }
  }, [hasConfig, isLoading, sessions, navigate]);

  // Show home screen only if no sessions exist
  if (isLoading || !hasConfig || sessions.length > 0) {
    return (
      <div className="h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  const handleGetStarted = async () => {
    const sessionId = await createNewSession();
    navigate(`/chat/${sessionId}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-background to-muted/50">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="text-6xl mb-4">💬</div>
        <h1 className="text-3xl font-bold mb-4">Chatbot Agent</h1>
        <p className="text-muted-foreground mb-8">
          Start a conversation with your AI assistant. Ask questions, get
          creative, or just chat about anything.
        </p>
        <Button onClick={handleGetStarted} className="w-full py-6 text-lg">
          Get Started
        </Button>
      </div>
    </div>
  );
};
