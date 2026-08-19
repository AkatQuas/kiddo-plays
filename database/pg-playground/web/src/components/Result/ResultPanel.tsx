import { Tabs } from 'antd';
import { useApp } from '../../contexts/AppContext';
import DataView from './DataView';
import ExplainView from './ExplainView';
import MessageLog from './MessageLog';
import LockGraph from './LockGraph';
import MigrationHistory from './MigrationHistory';

export default function ResultPanel() {
  const { state, dispatch } = useApp();
  const showLocks = state.chapter?.features?.lockGraph;
  const showMigration = state.chapter?.features?.migration;

  const items = [
    { key: 'data', label: '数据', children: <DataView /> },
    { key: 'explain', label: '执行计划', children: <ExplainView /> },
    { key: 'messages', label: '消息日志', children: <MessageLog /> },
  ];

  if (showLocks) {
    items.push({ key: 'locks', label: '锁等待图', children: <LockGraph /> });
  }
  if (showMigration) {
    items.push({ key: 'migration', label: '迁移历史', children: <MigrationHistory /> });
  }

  return (
    <Tabs
      activeKey={state.activeTab}
      onChange={(key) => dispatch({ type: 'SET_ACTIVE_TAB', payload: key as typeof state.activeTab })}
      items={items}
      size="small"
      className="px-2 h-full result-panel-tabs"
      style={{ height: '100%' }}
    />
  );
}
