import { useEffect, useState } from 'react';
import { Card, Input, Button, Space, Tabs, message } from 'antd';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../services/api';
import { remindUncheckedObjectives } from '../../utils/objectives';

const MIGRATION_DEFAULTS: Record<string, { up: string; down: string; name: string }> = {
  ch_13_migration_basics: {
    name: 'add_phone',
    up: 'ALTER TABLE app_users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);',
    down: 'ALTER TABLE app_users DROP COLUMN IF EXISTS phone;',
  },
  ch_14_migration_practice: {
    name: 'add_description',
    up: 'ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;',
    down: 'ALTER TABLE products DROP COLUMN IF EXISTS description;',
  },
};

export default function MigrationEditor() {
  const { state, dispatch } = useApp();
  const chapterId = state.currentChapterId || 'ch_14_migration_practice';
  const defaults = MIGRATION_DEFAULTS[chapterId] ?? MIGRATION_DEFAULTS.ch_14_migration_practice;

  const [version, setVersion] = useState('001');
  const [name, setName] = useState(defaults.name);
  const [upSql, setUpSql] = useState(defaults.up);
  const [downSql, setDownSql] = useState(defaults.down);

  useEffect(() => {
    const d = MIGRATION_DEFAULTS[chapterId] ?? MIGRATION_DEFAULTS.ch_14_migration_practice;
    setVersion('001');
    setName(d.name);
    setUpSql(d.up);
    setDownSql(d.down);
  }, [chapterId]);

  const handleUp = async () => {
    const res = await api.runMigrationUp(version, name, upSql);
    if (res.error) message.error(res.message);
    else {
      message.success('迁移已执行');
      dispatch({ type: 'SET_ACTIVE_TAB', payload: 'migration' });
      if (state.chapter) {
        remindUncheckedObjectives(state.chapter, state.completedObjectives);
      }
    }
  };

  const handleDown = async () => {
    const res = await api.runMigrationDown(version, downSql);
    if (res.error) message.error(res.message);
    else message.success('迁移已回滚');
  };

  return (
    <Card size="small" title="迁移文件编辑" className="h-full">
      <Space className="mb-3">
        <Input placeholder="版本号" value={version} onChange={(e) => setVersion(e.target.value)} style={{ width: 100 }} />
        <Input placeholder="迁移名称" value={name} onChange={(e) => setName(e.target.value)} style={{ width: 200 }} />
        <Button type="primary" onClick={handleUp}>执行迁移 (Up)</Button>
        <Button danger onClick={handleDown}>回滚迁移 (Down)</Button>
      </Space>
      <Tabs
        items={[
          {
            key: 'up',
            label: 'Up',
            children: (
              <textarea
                className="w-full h-40 font-mono text-sm p-2 border rounded"
                value={upSql}
                onChange={(e) => setUpSql(e.target.value)}
              />
            ),
          },
          {
            key: 'down',
            label: 'Down',
            children: (
              <textarea
                className="w-full h-40 font-mono text-sm p-2 border rounded"
                value={downSql}
                onChange={(e) => setDownSql(e.target.value)}
              />
            ),
          },
        ]}
      />
    </Card>
  );
}
