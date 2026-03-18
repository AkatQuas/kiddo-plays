import {
  AvatarIcon,
  ClockIcon,
  GlobeIcon,
  MixIcon,
  PersonIcon
} from '@radix-ui/react-icons';
import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypePrism from 'rehype-prism';
import type { Message } from '../../types/chat';
import { markdownUtils } from '../../utils/markdown';

interface ChatMessageProps {
  message: Message;
  isLast?: boolean;
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString();
};

const ChatMessageContent = memo(({ message }: { message: Message }) => {
  if (message.role === 'tool') {
    return (
      <div className="bg-muted p-3 rounded-md text-sm">
        <div className="flex items-center gap-2 mb-2">
          <GlobeIcon className="h-4 w-4 text-primary" />
          <span className="font-medium">Tool Execution</span>
        </div>
        <ReactMarkdown
          rehypePlugins={[rehypePrism]}
          components={markdownUtils.getRenderComponents()}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <ReactMarkdown
      rehypePlugins={[rehypePrism]}
      components={markdownUtils.getRenderComponents()}
    >
      {message.content}
    </ReactMarkdown>
  );
});

export const ChatMessage = memo(({ message, isLast }: ChatMessageProps) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isSystem = message.role === 'system';
  const isTool = message.role === 'tool';

  return (
    <div className={`flex gap-3 py-4 ${isLast ? 'mb-8' : 'mb-2'}`}>
      {/* Avatar */}
      <div className="flex-shrink-0 mt-1">
        {isUser && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <PersonIcon className="h-4 w-4" />
          </div>
        )}
        {isAssistant && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <AvatarIcon className="h-4 w-4" />
          </div>
        )}
        {isSystem && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <GlobeIcon className="h-4 w-4" />
          </div>
        )}
        {isTool && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <MixIcon className="h-4 w-4" />
          </div>
        )}
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center text-xs text-muted-foreground mb-1">
          {isUser && <span>You</span>}
          {isAssistant && <span>Assistant</span>}
          {isSystem && <span>System</span>}
          {isTool && <span>Tool</span>}
          <span className="flex items-center gap-1 ml-2">
            <ClockIcon className="h-3 w-3" />
            {formatTime(message.timestamp)}
          </span>
        </div>

        <ChatMessageContent message={message} />

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="max-w-[200px] rounded-md overflow-hidden border"
              >
                <img
                  src={attachment.url}
                  alt="Attachment"
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
