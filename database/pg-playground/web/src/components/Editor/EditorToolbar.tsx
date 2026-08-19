import {
  CheckOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { Button, Popconfirm, Space, Switch, message } from 'antd';
import type { editor } from 'monaco-editor';
import type { RefObject } from 'react';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../services/api';
import { remindUncheckedObjectives } from '../../utils/objectives';

export default function EditorToolbar({
  editorRef,
}: {
  editorRef: RefObject<editor.IStandaloneCodeEditor | null>;
}) {
  const { state, dispatch } = useApp();
  const chapterId = state.currentChapterId!;

  const handleExecute = async () => {
    if (state.preferences.clozeMode && state.chapter?.clozeTemplate) {
      const template = state.chapter.clozeTemplate;
      const placeholders = [...template.matchAll(/\{\{(\w+)\}\}/g)].map(
        (m) => m[1]
      );
      const missing = placeholders.filter((p) => !state.clozeValues[p]?.trim());
      if (missing.length > 0) {
        message.warning('请完成所有填空');
        return;
      }
    }

    dispatch({ type: 'SET_EXECUTING', payload: true });
    try {
      const sql =
        state.preferences.clozeMode && state.chapter?.clozeTemplate
          ? state.chapter.clozeTemplate
          : state.editorContent;

      const res = await api.executeQuery(chapterId, sql, {
        explain: state.preferences.explainMode,
        clozeValues: state.preferences.clozeMode
          ? state.clozeValues
          : undefined,
      });

      if (res.error) {
        message.error(res.message);
        dispatch({
          type: 'ADD_MESSAGES',
          payload: [
            {
              level: 'ERROR',
              message: res.message,
              timestamp: new Date().toISOString(),
            },
          ],
        });
      } else if (res.data) {
        dispatch({ type: 'SET_RESULT', payload: res.data });
        dispatch({ type: 'ADD_MESSAGES', payload: res.data.messages });
        dispatch({
          type: 'SET_ACTIVE_TAB',
          payload: state.preferences.explainMode ? 'explain' : 'data',
        });
        message.success(`执行完成 (${res.data.executionTimeMs}ms)`);
        if (state.chapter) {
          remindUncheckedObjectives(state.chapter, state.completedObjectives);
        }
      }
    } finally {
      dispatch({ type: 'SET_EXECUTING', payload: false });
    }
  };

  const handleCommit = async () => {
    const res = await api.commit(chapterId);
    if (res.error) message.error(res.message);
    else {
      message.success('事务已提交');
      dispatch({ type: 'SET_TRANSACTION_ACTIVE', payload: false });
    }
  };

  const handleRollback = async () => {
    const res = await api.rollback(chapterId);
    if (res.error) message.error(res.message);
    else {
      message.success('事务已回滚');
      dispatch({ type: 'SET_TRANSACTION_ACTIVE', payload: false });
    }
  };

  const handleReset = async () => {
    const res = await api.resetChapter(chapterId);
    if (res.error) message.error(res.message);
    else message.success('章节数据已重置');
  };

  const handleClear = () => {
    dispatch({ type: 'SET_EDITOR_CONTENT', payload: '' });
    if (editorRef.current) editorRef.current.setValue('');
  };

  return (
    <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
      <Space>
        <Button
          id="execute-sql-btn"
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={state.executing}
          onClick={handleExecute}
        >
          执行
        </Button>
        {state.transactionActive && (
          <>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              style={{ background: '#52c41a' }}
              onClick={handleCommit}
            >
              提交
            </Button>
            <Button danger icon={<RollbackOutlined />} onClick={handleRollback}>
              回滚
            </Button>
          </>
        )}
        <Popconfirm
          title="将重置当前章节所有数据，确定吗？"
          onConfirm={handleReset}
        >
          <Button icon={<ReloadOutlined />}>重置数据</Button>
        </Popconfirm>
        <Button icon={<DeleteOutlined />} onClick={handleClear}>清空</Button>
      </Space>
      <Space>
        <Switch
          checkedChildren="📊 执行计划"
          unCheckedChildren="执行计划"
          checked={state.preferences.explainMode}
          onChange={(v) =>
            dispatch({ type: 'SET_PREFERENCE', payload: { explainMode: v } })
          }
        />
        <Switch
          checkedChildren="📝 填空"
          unCheckedChildren="填空模式"
          checked={state.preferences.clozeMode}
          onChange={(v) =>
            dispatch({ type: 'SET_PREFERENCE', payload: { clozeMode: v } })
          }
        />
      </Space>
    </div>
  );
}
