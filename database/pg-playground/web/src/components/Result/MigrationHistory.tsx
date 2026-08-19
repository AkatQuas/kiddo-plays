import { useEffect, useState } from 'react';
import { Table, Tag } from 'antd';
import { api } from '../../services/api';
import type { MigrationRecord } from '../../types';

export default function MigrationHistory() {
  const [history, setHistory] = useState<MigrationRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getMigrationHistory()
      .then((res) => {
        if (res.data) setHistory(res.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <Tag color={s === 'success' ? 'success' : 'error'}>{s}</Tag>
      ),
    },
    {
      title: '执行时间',
      dataIndex: 'executed_at',
      key: 'executed_at',
      render: (t: string) => new Date(t).toLocaleString(),
    },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 100 },
  ];

  return (
    <Table
      dataSource={history}
      columns={columns}
      rowKey="version"
      size="small"
      loading={loading}
      pagination={false}
      scroll={{ y: 'calc(50vh - 140px)' }}
    />
  );
}
