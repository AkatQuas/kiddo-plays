import { List, Tag, Typography } from 'antd';
import { useApp } from '../../contexts/AppContext';

const { Text } = Typography;

const levelColors: Record<string, string> = {
  INFO: 'blue',
  WARNING: 'warning',
  ERROR: 'error',
  NOTICE: 'cyan',
};

export default function MessageLog() {
  const { state } = useApp();
  const messages = state.result?.messages.length
    ? state.result.messages
    : state.messageLog;

  const transactionLabel = state.transactionActive ? '进行中' : '未开始';

  return (
    <div>
      <div className="mb-2 text-xs">
        <Tag color={state.transactionActive ? 'processing' : 'default'}>
          事务: {transactionLabel}
        </Tag>
        {state.result && (
          <Tag color="blue">{state.result.executionTimeMs}ms</Tag>
        )}
      </div>
      <List
        size="small"
        dataSource={messages}
        locale={{ emptyText: '暂无消息' }}
        renderItem={(item) => (
          <List.Item className="py-1">
            <div className="w-full">
              <div className="flex items-center gap-2">
                <Tag color={levelColors[item.level]}>{item.level}</Tag>
                <Text type="secondary" className="text-xs">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </Text>
              </div>
              <Text className="text-sm">{item.message}</Text>
            </div>
          </List.Item>
        )}
      />
      {state.result?.sql && (
        <div className="mt-4 p-2 bg-gray-50 rounded text-xs font-mono overflow-auto max-h-32">
          {state.result.sql}
        </div>
      )}
    </div>
  );
}
