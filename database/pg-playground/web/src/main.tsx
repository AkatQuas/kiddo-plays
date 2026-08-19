import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import { AppProvider } from './contexts/AppContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: { colorPrimary: '#336791', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' },
          algorithm: theme.defaultAlgorithm,
        }}
      >
        <App />
      </ConfigProvider>
    </AppProvider>
  </StrictMode>,
);
