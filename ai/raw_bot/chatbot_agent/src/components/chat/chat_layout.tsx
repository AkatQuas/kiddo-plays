import { ChevronLeftIcon } from '@radix-ui/react-icons';
import { Outlet } from 'react-router-dom';
import { useSessionList } from '../../hooks/use_session_list';
import { Button } from '../common/button';

interface ChatLayoutProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const ChatLayout = ({
  sidebarOpen,
  setSidebarOpen
}: ChatLayoutProps) => {
  const { currentSessionId } = useSessionList();

  return (
    <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Chat header - 仅在有会话时显示 */}
      {currentSessionId && (
        <header className="border-b p-4 flex items-center justify-between z-10 bg-background">
          {/* 移动端侧边栏切换按钮 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden mr-2"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Chat</h1>
        </header>
      )}

      {/* Chat content - 自适应高度 */}
      <main
        className={`flex-1 overflow-hidden ${currentSessionId ? '' : 'flex items-center justify-center'}`}
      >
        <Outlet context={{ sessionId: currentSessionId }} />
      </main>
    </div>
  );
};
