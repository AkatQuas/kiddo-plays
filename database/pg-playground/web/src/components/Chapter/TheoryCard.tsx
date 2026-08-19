import { Alert, Badge, Card, Checkbox, Collapse, Tag, Typography } from 'antd';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useApp } from '../../contexts/AppContext';
import {
  areAllObjectivesComplete,
  getUncheckedObjectiveCount,
  isObjectiveComplete,
  objectiveKey,
} from '../../utils/objectives';

const { Text } = Typography;

export default function TheoryCard() {
  const { state, dispatch } = useApp();
  const [expanded, setExpanded] = useState(true);
  const chapter = state.chapter!;

  const uncheckedCount = getUncheckedObjectiveCount(
    chapter,
    state.completedObjectives
  );
  const allComplete = areAllObjectivesComplete(
    chapter,
    state.completedObjectives
  );

  return (
    <Card
      size="small"
      title={
        <span>
          {chapter.title}
          <Tag color="blue" className="ml-2">
            {chapter.category}
          </Tag>
        </span>
      }
      extra={
        <a onClick={() => setExpanded(!expanded)}>
          {expanded ? '收起' : '展开'}
        </a>
      }
    >
      {expanded && (
        <div className="space-y-4">
          {!allComplete && (
            <Alert
              type="warning"
              closable
              showIcon
              title="记得勾选学习目标"
              description={
                uncheckedCount === chapter.learningObjectives.length
                  ? '完成实验后，请勾选下方学习目标，进度条会同步更新。'
                  : `还有 ${uncheckedCount} 项未勾选，全部勾选后本章将标记为已完成。`
              }
            />
          )}

          {allComplete && (
            <Alert type="success" showIcon message="本章学习目标已全部完成" />
          )}

          <div
            className={
              uncheckedCount > 0
                ? 'rounded-md border border-amber-300 bg-amber-50/50 p-3'
                : ''
            }
          >
            <Text strong>
              学习目标
              {uncheckedCount > 0 && (
                <Badge
                  count={uncheckedCount}
                  size="small"
                  className="ml-2"
                  title="未勾选的学习目标"
                />
              )}
            </Text>
            <div className="mt-2 space-y-1">
              {chapter.learningObjectives.map((obj, idx) => (
                <Checkbox
                  key={idx}
                  checked={isObjectiveComplete(chapter.id, idx, state.completedObjectives)}
                  onChange={() =>
                    dispatch({
                      type: 'TOGGLE_OBJECTIVE',
                      payload: objectiveKey(chapter.id, idx),
                    })
                  }
                >
                  {obj}
                </Checkbox>
              ))}
            </div>
          </div>

          <Collapse
            size="small"
            items={[
              {
                key: 'theory',
                label: '核心概念',
                children: (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{chapter.theory}</ReactMarkdown>
                  </div>
                ),
              },
              {
                key: 'dataset',
                label: '示例数据集',
                children: (
                  <div>
                    <Text>{chapter.dataset.description}</Text>
                    <div className="mt-2">
                      {chapter.dataset.tables.map((t) => (
                        <Tag key={t}>{t}</Tag>
                      ))}
                    </div>
                  </div>
                ),
              },
            ]}
            defaultActiveKey={['theory']}
          />
        </div>
      )}
    </Card>
  );
}
