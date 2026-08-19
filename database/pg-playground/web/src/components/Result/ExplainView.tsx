import { Tree, Empty, Tag, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { useApp } from '../../contexts/AppContext';

const { Text } = Typography;

interface ExplainNode {
  'Node Type': string;
  'Startup Cost'?: number;
  'Total Cost'?: number;
  'Plan Rows'?: number;
  'Actual Rows'?: number;
  'Actual Total Time'?: number;
  'Shared Hit Blocks'?: number;
  'Shared Read Blocks'?: number;
  Plans?: ExplainNode[];
}

function buildTreeNodes(node: ExplainNode, totalCost: number, key = '0'): DataNode {
  const nodeCost = node['Total Cost'] || 0;
  const isSeqScan = node['Node Type']?.includes('Seq Scan');
  const isHighCost = totalCost > 0 && nodeCost / totalCost > 0.3;

  const title = (
    <span>
      <Text strong>{node['Node Type']}</Text>
      {node['Actual Total Time'] !== undefined && (
        <Text type="secondary" className="ml-2 text-xs">
          {node['Actual Total Time']?.toFixed(2)}ms
        </Text>
      )}
      {isSeqScan && <Tag color="warning" className="ml-1">Seq Scan</Tag>}
      {isHighCost && <Tag color="error" className="ml-1">高 Cost</Tag>}
    </span>
  );

  const children = (node.Plans || []).map((child, idx) =>
    buildTreeNodes(child, totalCost, `${key}-${idx}`),
  );

  return { key, title, children };
}

function parseExplain(explain: unknown): ExplainNode | null {
  if (!explain) return null;
  if (Array.isArray(explain)) {
    const first = explain[0] as { Plan?: ExplainNode };
    return first?.Plan || null;
  }
  if (typeof explain === 'object' && explain !== null) {
    const obj = explain as { Plan?: ExplainNode };
    return obj.Plan || (explain as ExplainNode);
  }
  return null;
}

export default function ExplainView() {
  const { state } = useApp();
  const plan = parseExplain(state.result?.explain);

  if (!plan) {
    return <Empty description="开启执行计划模式后执行 SQL" className="mt-8" />;
  }

  const totalCost = plan['Total Cost'] || 1;
  const treeData = [buildTreeNodes(plan, totalCost)];

  return (
    <div>
      <div className="mb-2 text-xs text-gray-500">
        Cost: {plan['Startup Cost']} ~ {plan['Total Cost']}
        {plan['Actual Rows'] !== undefined && ` | 实际行数: ${plan['Actual Rows']}`}
      </div>
      <Tree
        showLine
        defaultExpandAll
        treeData={treeData}
        className="text-sm"
      />
    </div>
  );
}
