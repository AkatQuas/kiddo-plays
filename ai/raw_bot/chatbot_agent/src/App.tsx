import { useState } from 'react';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { ChatLayout } from './components/chat/chat_layout';
import { Sidebar } from './components/layout/sidebar';
import { NotFound } from './pages/404';
import { Chat } from './pages/chat';
import { Config } from './pages/config';
import { Home } from './pages/home';
import { configStore } from './store/config';

// Initialize config on app load
configStore.getState().loadConfig();

export const App = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <Router>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        {/* Sidebar - 固定宽度，不重叠 */}
        <div
          className={`${sidebarOpen ? 'w-72' : 'w-0 lg:w-72'} flex-shrink-0 transition-all duration-200`}
        >
          <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        </div>

        {/* Main content - 自适应剩余宽度，防止重叠 */}
        <div className="flex-1 overflow-hidden">
          {/* 移动端侧边栏打开时添加偏移，防止内容被覆盖 */}
          <div
            className={`h-full w-full transition-all duration-200 ${sidebarOpen ? 'lg:ml-0' : 'ml-0'}`}
          >
            <Routes>
              <Route path="/" element={<Home />} />
              <Route
                path="/chat"
                element={
                  <ChatLayout
                    sidebarOpen={sidebarOpen}
                    setSidebarOpen={setSidebarOpen}
                  />
                }
              >
                <Route index element={<Home />} />
                <Route path=":sessionId" element={<Chat />} />
              </Route>
              <Route path="/config" element={<Config />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
};

export default App;
