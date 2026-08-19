import { Layout, Progress, Typography } from 'antd';
import { calcProgressPercent } from '../../contexts/AppContext';
import { useApp } from '../../contexts/AppContext';

const { Header } = Layout;
const { Title } = Typography;

export default function AppHeader() {
  const { state } = useApp();
  const percent = calcProgressPercent(state.categories, state.progress);

  return (
    <Header
      className="flex items-center justify-between px-6"
      style={{ background: '#336791', height: 64, lineHeight: '64px' }}
    >
      <Title level={4} style={{ color: '#fff', margin: 0 }}>
        PG 实战营
        <span className="text-sm font-normal opacity-80 ml-2">Postgres Playground</span>
      </Title>
      <div className="flex items-center gap-4">
        <span className="text-white text-sm opacity-90">学习进度</span>
        <Progress
          percent={percent}
          size="small"
          strokeColor="#52c41a"
          trailColor="rgba(255,255,255,0.3)"
          style={{ width: 200 }}
        />
      </div>
    </Header>
  );
}
