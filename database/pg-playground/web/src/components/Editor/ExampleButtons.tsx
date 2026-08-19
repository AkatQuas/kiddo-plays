import { Button, Space, Tooltip } from 'antd';
import { useApp } from '../../contexts/AppContext';

export default function ExampleButtons({ onInsert }: { onInsert: (sql: string) => void }) {
  const { state } = useApp();
  const examples = state.chapter?.examples || [];

  return (
    <div className="px-3 py-2 border-b border-gray-100 flex gap-2 flex-wrap">
      {examples.map((ex, idx) => (
        <Tooltip key={idx} title={ex.tooltip || ex.sql}>
          <Button size="small" onClick={() => onInsert(ex.sql)}>
            {ex.label}
          </Button>
        </Tooltip>
      ))}
    </div>
  );
}
