import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { App } from './App';
import { TitleBar } from './components/TitleBar';
import { initI18n } from './i18n';
import './index.css';

const init = async () => {
  await initI18n();

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  createRoot(rootElement).render(
    <StrictMode>
      <TitleBar />
      <App />
      <Toaster position="bottom-right" richColors />
    </StrictMode>
  );
};

init();
