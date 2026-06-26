import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Components } from 'react-markdown';
import type { PluggableList } from 'unified';
import { remarkUiDirectivePlugins } from './plugins/remarkUiDirective';
import { rehypeUiBlock } from './plugins/rehypeUiBlock';
import { wrapRemarkPlugins } from './utils/safePlugins';
import { normalizeUiDirectiveSyntax } from './utils/normalizeUiDirectiveSyntax';
import { createUiComponentRenderer } from './utils/createUiComponentRenderer';
import { UiCard, UiButton, UiForm, UiPanel } from './components';
import type { MarkdownRenderProps } from './types';
import './components/styles.css';

export function MarkdownRender({
  content,
  remarkPlugins = [],
  rehypePlugins = [],
  uiComponents,
  onAction,
  className,
}: MarkdownRenderProps) {
  const normalizedContent = useMemo(
    () => normalizeUiDirectiveSyntax(content),
    [content],
  );

  const mergedRemarkPlugins = useMemo(
    () => [
      ...wrapRemarkPlugins(remarkPlugins),
      ...remarkUiDirectivePlugins,
      remarkGfm,
    ],
    [remarkPlugins],
  );

  const mergedRehypePlugins = useMemo(
    () => [...rehypePlugins, rehypeUiBlock, rehypeHighlight],
    [rehypePlugins],
  );

  const components = useMemo(
    () =>
      ({
        'ui-card': createUiComponentRenderer(
          UiCard,
          uiComponents,
          'UiCard',
          onAction,
        ),
        'ui-button': createUiComponentRenderer(
          UiButton,
          uiComponents,
          'UiButton',
          onAction,
        ),
        'ui-form': createUiComponentRenderer(
          UiForm,
          uiComponents,
          'UiForm',
          onAction,
        ),
        'ui-panel': createUiComponentRenderer(
          UiPanel,
          uiComponents,
          'UiPanel',
          onAction,
        ),
      }) as Components,
    [uiComponents, onAction],
  );

  return (
    <div className={className ? `markdown-render ${className}` : 'markdown-render'}>
      <ReactMarkdown
        remarkPlugins={mergedRemarkPlugins as PluggableList}
        rehypePlugins={mergedRehypePlugins as PluggableList}
        components={components}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownRender;
