import { Spin } from 'antd';
import { useApp } from '../../contexts/AppContext';
import TheoryCard from '../Chapter/TheoryCard';
import MigrationEditor from '../Editor/MigrationEditor';
import SqlEditor from '../Editor/SqlEditor';
import ResultPanel from '../Result/ResultPanel';

export default function MainContent() {
  const { state } = useApp();

  if (state.loading && !state.chapter) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spin size="large" />
      </div>
    );
  }

  if (!state.chapter) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        请从左侧选择章节开始学习
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex p-4 gap-4">
      <div className="w-[500px] shrink-0 overflow-auto border-r border-gray-100">
        <TheoryCard />
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 min-h-0 pb-2 overflow-hidden">
          {state.chapter.features?.migration ? (
            <MigrationEditor />
          ) : (
            <SqlEditor />
          )}
        </div>
        <div className="flex-1 min-h-0 border-t border-gray-100">
          <ResultPanel />
        </div>
      </div>
    </div>
  );
}
