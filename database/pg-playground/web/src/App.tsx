import { useEffect } from 'react';
import { Layout } from 'antd';
import { api } from './services/api';
import { useApp } from './contexts/AppContext';
import { syncChapterStatusFromObjectives } from './utils/objectives';
import AppHeader from './components/Layout/AppHeader';
import Sidebar from './components/Layout/Sidebar';
import MainContent from './components/Layout/MainContent';

const { Content } = Layout;

export default function App() {
  const { state, dispatch } = useApp();

  useEffect(() => {
    api.getChapters().then((res) => {
      if (res.data) {
        dispatch({ type: 'SET_CATEGORIES', payload: res.data });
        const firstChapter = res.data[0]?.chapters[0];
        if (firstChapter && !state.currentChapterId) {
          loadChapter(firstChapter.id);
        }
      }
    });
  }, []);

  const loadChapter = async (id: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const res = await api.getChapter(id);
      if (res.data) {
        dispatch({ type: 'SET_CHAPTER', payload: res.data });
        let statusToSet = syncChapterStatusFromObjectives(
          res.data,
          state.completedObjectives,
          state.progress[id],
        );
        if (statusToSet === 'not_started') {
          statusToSet = 'in_progress';
        }
        if (statusToSet !== state.progress[id]) {
          dispatch({ type: 'SET_CHAPTER_STATUS', payload: { id, status: statusToSet } });
        }
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  return (
    <Layout className="h-screen">
      <AppHeader />
      <Layout>
        <Sidebar onSelectChapter={loadChapter} />
        <Content className="flex-1 overflow-hidden">
          <MainContent />
        </Content>
      </Layout>
    </Layout>
  );
}
