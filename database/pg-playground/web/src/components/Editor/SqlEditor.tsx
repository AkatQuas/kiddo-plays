import { useRef, useCallback } from 'react';
import { Card } from 'antd';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useApp } from '../../contexts/AppContext';
import EditorToolbar from './EditorToolbar';
import ExampleButtons from './ExampleButtons';
import ClozePanel from './ClozePanel';

export default function SqlEditor() {
  const { state, dispatch } = useApp();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const onMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.addAction({
      id: 'execute-sql',
      label: 'Execute SQL',
      keybindings: [2048 + 3],
      run: () => document.getElementById('execute-sql-btn')?.click(),
    });
  };

  const replaceContent = useCallback((sql: string) => {
    dispatch({ type: 'SET_EDITOR_CONTENT', payload: sql });
    const ed = editorRef.current;
    if (ed) {
      ed.setValue(sql);
      ed.focus();
    }
  }, [dispatch]);

  const theme = state.preferences.theme === 'dark' ? 'vs-dark' : 'vs';

  return (
    <Card
      size="small"
      title="SQL 编辑器"
      className="h-full flex flex-col"
      styles={{ body: { padding: 0, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } }}
    >
      <ExampleButtons onInsert={replaceContent} />
      <EditorToolbar editorRef={editorRef} />
      {state.preferences.clozeMode && state.chapter?.clozeTemplate ? (
        <ClozePanel template={state.chapter.clozeTemplate} />
      ) : (
        <div className="flex-1 min-h-0">
          <Editor
            height="100%"
            language="sql"
            theme={theme}
            value={state.editorContent}
            onChange={(v) => dispatch({ type: 'SET_EDITOR_CONTENT', payload: v || '' })}
            onMount={onMount}
            options={{
              fontSize: state.preferences.fontSize,
              fontFamily: 'JetBrains Mono, monospace',
              lineNumbers: 'on',
              minimap: { enabled: false },
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              guides: { indentation: true },
            }}
          />
        </div>
      )}
    </Card>
  );
}
