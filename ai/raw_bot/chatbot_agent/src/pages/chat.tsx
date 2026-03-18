import { useParams } from 'react-router-dom';
import { ChatInput } from '../components/chat/chat_input';
import { ChatMessageList } from '../components/chat/chat_message_list';

export const Chat = () => {
  const { sessionId = null } = useParams<{ sessionId: string }>();

  return (
    <div className="flex flex-col h-full w-full">
      {/* Message list */}
      <div className="flex-1 overflow-hidden">
        <ChatMessageList sessionId={sessionId} />
      </div>

      {/* Message input */}
      <ChatInput sessionId={sessionId} />
    </div>
  );
};
