import { Input } from 'antd';
import { useApp } from '../../contexts/AppContext';

export default function ClozePanel({ template }: { template: string }) {
  const { state, dispatch } = useApp();

  const parts = template.split(/(\{\{\w+\}\})/g);

  return (
    <div className="p-4 font-mono text-sm bg-gray-50 border-t" style={{ minHeight: 120 }}>
      {parts.map((part, idx) => {
        const match = part.match(/^\{\{(\w+)\}\}$/);
        if (match) {
          const key = match[1];
          return (
            <Input
              key={idx}
              className="cloze-input inline-block w-auto mx-1"
              size="small"
              placeholder={key}
              value={state.clozeValues[key] || ''}
              onChange={(e) =>
                dispatch({ type: 'SET_CLOZE_VALUE', payload: { key, value: e.target.value } })
              }
            />
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </div>
  );
}
