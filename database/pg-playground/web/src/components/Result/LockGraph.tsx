import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Empty } from 'antd';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../services/api';

interface LockRow {
  pid: number;
  state: string;
  wait_event_type: string | null;
  query: string;
}

export default function LockGraph() {
  const { state } = useApp();
  const [locks, setLocks] = useState<LockRow[]>([]);

  useEffect(() => {
    if (!state.chapter?.features?.lockGraph) return;

    const fetchLocks = async () => {
      const res = await api.executeQuery(state.currentChapterId!, `
        SELECT pid, state, wait_event_type, left(query, 60) AS query
        FROM pg_stat_activity
        WHERE datname = current_database() AND pid <> pg_backend_pid();
      `);
      if (res.data?.rows) {
        setLocks(res.data.rows as unknown as LockRow[]);
      }
    };

    fetchLocks();
    const interval = setInterval(fetchLocks, 5000);
    return () => clearInterval(interval);
  }, [state.currentChapterId, state.chapter?.features?.lockGraph]);

  if (locks.length === 0) {
    return <Empty description="暂无其他活动会话" className="mt-8" />;
  }

  const nodes = locks.map((l) => ({
    id: String(l.pid),
    name: `PID ${l.pid}`,
    symbolSize: 40,
    itemStyle: {
      color: l.wait_event_type ? '#ff4d4f' : '#52c41a',
    },
    label: { show: true, fontSize: 10 },
  }));

  const links = locks
    .filter((l) => l.wait_event_type)
    .map((l) => ({
      source: String(l.pid),
      target: locks.find((o) => o.pid !== l.pid)?.pid ? String(locks.find((o) => o.pid !== l.pid)!.pid) : String(l.pid),
    }));

  const option = {
    tooltip: {
      formatter: (params: { data: { name: string } }) => {
        const lock = locks.find((l) => `PID ${l.pid}` === params.data.name);
        if (!lock) return '';
        return `PID: ${lock.pid}<br/>状态: ${lock.state}<br/>等待: ${lock.wait_event_type || '无'}<br/>查询: ${lock.query}`;
      },
    },
    series: [{
      type: 'graph',
      layout: 'force',
      data: nodes,
      links,
      roam: true,
      force: { repulsion: 200, edgeLength: 100 },
      lineStyle: { color: '#faad14', curveness: 0.2 },
    }],
  };

  return <ReactECharts option={option} style={{ height: 300 }} />;
}
