import { ArrowDownIcon, ArrowUpIcon } from '@radix-ui/react-icons';
import { useMessageList } from '../../hooks/use_message_list';
import { Button } from '../common/button';
import { ChatMessage } from './chat_message';

interface ChatMessageListProps {
  sessionId: string | null;
}

export const ChatMessageList = ({ sessionId }: ChatMessageListProps) => {
  const {
    containerRef,
    virtualizer,
    messages,
    isAtBottom,
    handleScroll,
    scrollToBottom,
    scrollToTop
  } = useMessageList(sessionId);

  // Show empty state when no messages
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="mb-4 text-6xl text-muted-foreground">💬</div>
        <h3 className="text-xl font-medium mb-2">Start a conversation</h3>
        <p className="text-muted-foreground max-w-md">
          Type a message to begin chatting with the assistant. You can ask
          questions, get help, or just have a conversation.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-auto"
      onScroll={handleScroll}
    >
      {/* Scroll to top button */}
      {!isAtBottom && (
        <div className="fixed bottom-20 right-4 z-10">
          <Button
            variant="secondary"
            size="icon"
            onClick={scrollToBottom}
            className="shadow-lg"
          >
            <ArrowDownIcon className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Scroll to bottom button */}
      <div className="fixed top-4 right-4 z-10">
        <Button
          variant="secondary"
          size="icon"
          onClick={scrollToTop}
          className="shadow-lg"
        >
          <ArrowUpIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Virtualized message list */}
      <div
        className="relative h-full w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const message = messages[virtualItem.index];
          console.debug(
            '\x1B[97;100;1m --- message --- \x1B[m',
            '\n',
            message,
            virtualItem
          );
          if (!message.content) {
            return null;
          }
          return (
            <div
              key={message.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
                height: `${virtualItem.size}px`,
                padding: '0 1rem'
              }}
            >
              <ChatMessage
                message={message}
                isLast={virtualItem.index === messages.length - 1}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
