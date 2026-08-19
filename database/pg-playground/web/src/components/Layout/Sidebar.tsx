import {
  CheckCircleFilled,
  MinusCircleFilled,
  PlayCircleFilled,
} from '@ant-design/icons';
import { Layout, Menu } from 'antd';
import { getChapterStatus, useApp } from '../../contexts/AppContext';
import type { ChapterStatus } from '../../types';

const { Sider } = Layout;

function StatusIcon({ status }: { status: ChapterStatus }) {
  if (status === 'completed')
    return <CheckCircleFilled style={{ color: '#52c41a' }} />;
  if (status === 'in_progress')
    return <PlayCircleFilled style={{ color: '#1890ff' }} />;
  return <MinusCircleFilled style={{ color: '#d9d9d9' }} />;
}

export default function Sidebar({
  onSelectChapter,
}: {
  onSelectChapter: (id: string) => void;
}) {
  const { state, dispatch } = useApp();

  const menuItems = state.categories.map((group) => ({
    key: group.category,
    label: group.category,
    children: group.chapters.map((ch) => ({
      key: ch.id,
      label: (
        <span className="flex items-center gap-2">
          <StatusIcon status={getChapterStatus(state.progress, ch.id)} />
          {ch.title}
        </span>
      ),
    })),
  }));

  return (
    <Sider
      width={200}
      collapsedWidth={56}
      collapsed={state.sidebarCollapsed}
      onCollapse={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
      collapsible
      theme="light"
      style={{ borderRight: '1px solid #f0f0f0' }}
    >
      <Menu
        mode="inline"
        selectedKeys={state.currentChapterId ? [state.currentChapterId] : []}
        defaultOpenKeys={state.chapter ? [state.chapter.category] : []}
        items={menuItems}
        onClick={({ key }) => onSelectChapter(key)}
        style={{ borderRight: 0, height: 'calc(100vh - 64px)' }}
      />
    </Sider>
  );
}
