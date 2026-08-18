import { useEffect, useMemo, useRef } from 'preact/hooks';
import type { FileEntry } from '../types';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';

hljs.registerLanguage('typescript', typescript);

type Props = { file: FileEntry | null };

// ─── 段落定义 ──────────────────────────────────────

type ProblemDesc = { lines: string[] };
type SolutionBlock = { title: string; code: string };
type Page = { problem: ProblemDesc; solutions: SolutionBlock[] };

// ─── 解析器 ─────────────────────────────────────────

function parsePage(code: string): Page {
  const lines = code.split('\n');
  const page: Page = { problem: { lines: [] }, solutions: [] };
  let i = 0;

  while (i < lines.length && lines[i].trim() === '') i++;

  // 1. 头部 JSDoc → 题目说明
  if (i < lines.length && lines[i].trimStart().startsWith('/**')) {
    const commentLines: string[] = [];
    commentLines.push(lines[i]); i++;
    while (i < lines.length && !lines[i].trimEnd().endsWith('*/')) {
      commentLines.push(lines[i]); i++;
    }
    if (i < lines.length) { commentLines.push(lines[i]); i++; }

    const extracted: string[] = [];
    for (const cl of commentLines) {
      const t = cl.trim();
      if (t === '/**' || t === '*/') continue;
      if (t.startsWith('* ')) extracted.push(t.slice(2).trim());
      else if (t.startsWith('*')) extracted.push(t.slice(1).trim());
    }
    page.problem.lines = extracted.filter(l => {
      if (/^[=\-—━]+$/.test(l)) return false;
      if (l === '') return false;
      return true;
    });
  }

  // 2. // ─── 标题 ─── 分段
  while (i < lines.length) {
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) break;

    const line = lines[i].trim();

    if (line.startsWith('//') && line.includes('──')) {
      const title = line.replace(/^\/\/\s*/, '').replace(/[─]+/g, '').trim();
      i++;

      const codeLines: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        if (l.trimStart().startsWith('//') && l.trimStart().includes('──')) break;
        codeLines.push(l); i++;
      }
      while (codeLines.length > 0 && codeLines[codeLines.length - 1].trim() === '') codeLines.pop();

      if (codeLines.length > 0) {
        page.solutions.push({ title, code: codeLines.join('\n') });
      }
      continue;
    }

    // 没有标记的代码段
    const codeLines: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      if (l.trimStart().startsWith('//') && l.trimStart().includes('──')) break;
      if (l.trimStart().startsWith('/**')) break;
      codeLines.push(l); i++;
    }
    while (codeLines.length > 0 && codeLines[codeLines.length - 1].trim() === '') codeLines.pop();
    if (codeLines.length > 0) {
      page.solutions.push({ title: '', code: codeLines.join('\n') });
    }
  }

  return page;
}

// ─── CommentPanel: 左栏说明 ─────────────────────────

function CommentPanel({ lines }: { lines: string[] }) {
  return (
    <div class="comment-panel">
      {lines.map((line, i) => {
        const firstChar = line.codePointAt(0);
        const isEmojiHeading = firstChar !== undefined && firstChar >= 0x1f000;

        if (isEmojiHeading || line.startsWith('===')) {
          return <div key={i} class="comment-heading">{line}</div>;
        }
        if (line.startsWith('---') || line.startsWith('━━')) {
          return <hr key={i} class="comment-hr" />;
        }
        if (line.trim() === '') {
          return <div key={i} class="comment-spacer" />;
        }
        if (line.startsWith('  dp[') || (line.includes('=') && (line.includes('+') || line.includes('min') || line.includes('max')))) {
          return <div key={i} class="comment-code">{line}</div>;
        }
        return <div key={i} class="comment-line">{line}</div>;
      })}
    </div>
  );
}

// ─── CodePanel: 右栏代码 ────────────────────────────

function CodePanel({ code, title }: { code: string; title?: string }) {
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (preRef.current) {
      const codeEl = preRef.current.querySelector('code');
      if (codeEl) hljs.highlightElement(codeEl);
    }
  }, [code]);

  return (
    <div class="code-panel">
      {title && <div class="code-panel-title">{title}</div>}
      <pre ref={preRef} class="code-panel-content">
        <code class="language-typescript">{code}</code>
      </pre>
    </div>
  );
}

// ─── 主组件：双栏固定布局 ───────────────────────────

export function ContentView({ file }: Props) {
  const page = useMemo(() => file ? parsePage(file.code) : null, [file]);

  if (!file) {
    return (
      <main class="content-view empty">
        <div class="empty-state">
          <div class="empty-icon">📖</div>
          <p>从左侧选择一个章节开始学习</p>
        </div>
      </main>
    );
  }

  const hasProblem = page && page.problem.lines.length > 0;

  return (
    <div class="split-layout">
      {/* 左栏：题目描述 + 标题 */}
      <div class="split-left">
        <div class="split-left-inner">
          <h2 class="left-title">{file.title}</h2>
          <span class="left-path">{file.filePath}</span>
          {hasProblem && <CommentPanel lines={page!.problem.lines} />}
          {!hasProblem && <div class="comment-panel"><div class="comment-line">无详细题目说明</div></div>}
        </div>
      </div>

      {/* 右栏：所有解法依次展开 */}
      <div class="split-right">
        {page && page.solutions.length > 0 ? (
          page.solutions.map((sol, i) => (
            <CodePanel key={i} code={sol.code} title={sol.title} />
          ))
        ) : (
          <div class="split-right-empty">暂无解法代码</div>
        )}
      </div>
    </div>
  );
}
