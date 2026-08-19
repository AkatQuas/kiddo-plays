import { Table, Empty, Dropdown, Button, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { useApp } from '../../contexts/AppContext';

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

export default function DataView() {
  const { state } = useApp();
  const result = state.result;

  if (!result) {
    return <Empty description="执行 SQL 后查看结果" className="mt-8" />;
  }

  if (result.rows.length === 0) {
    return <Empty description="查询返回 0 行" className="mt-8" />;
  }

  const columns = result.columns.map((col) => ({
    title: col,
    dataIndex: col,
    key: col,
    sorter: (a: Record<string, unknown>, b: Record<string, unknown>) => {
      const av = a[col];
      const bv = b[col];
      if (av === null) return -1;
      if (bv === null) return 1;
      return String(av).localeCompare(String(bv));
    },
    render: (val: unknown) => {
      if (val === null || val === undefined) {
        return <span className="text-gray-400 bg-gray-100 px-1 rounded text-xs">NULL</span>;
      }
      if (typeof val === 'object') {
        return <pre className="text-xs m-0">{JSON.stringify(val, null, 2)}</pre>;
      }
      return formatCell(val);
    },
    ellipsis: true,
  }));

  const copyAs = (format: 'csv' | 'json') => {
    if (format === 'json') {
      navigator.clipboard.writeText(JSON.stringify(result.rows, null, 2));
    } else {
      const header = result.columns.join(',');
      const rows = result.rows.map((r) =>
        result.columns.map((c) => formatCell(r[c])).join(','),
      );
      navigator.clipboard.writeText([header, ...rows].join('\n'));
    }
    message.success('已复制到剪贴板');
  };

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <Dropdown
          menu={{
            items: [
              { key: 'csv', label: '复制为 CSV', onClick: () => copyAs('csv') },
              { key: 'json', label: '复制为 JSON', onClick: () => copyAs('json') },
            ],
          }}
        >
          <Button size="small" icon={<CopyOutlined />}>复制结果</Button>
        </Dropdown>
      </div>
      <Table
        dataSource={result.rows.map((r, i) => ({ ...r, key: i }))}
        columns={columns}
        size="small"
        pagination={{ pageSize: 50, showSizeChanger: false }}
        scroll={{ x: 'max-content', y: 'calc(50vh - 140px)' }}
      />
    </div>
  );
}
