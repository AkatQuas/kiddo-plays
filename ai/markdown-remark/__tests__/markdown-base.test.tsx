import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownRender } from '../src/MarkdownRender';

describe('markdown base rendering', () => {
  it('renders plain text, headings, and lists', () => {
    const content = `# Title\n\nParagraph text\n\n- item one\n- item two`;
    render(<MarkdownRender content={content} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Title' })).toBeInTheDocument();
    expect(screen.getByText('Paragraph text')).toBeInTheDocument();
    expect(screen.getByText('item one')).toBeInTheDocument();
    expect(screen.getByText('item two')).toBeInTheDocument();
  });

  it('renders gfm tables', () => {
    const content = `| Name | Price |\n| --- | --- |\n| Keyboard | 129 |`;
    render(<MarkdownRender content={content} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Keyboard')).toBeInTheDocument();
    expect(screen.getByText('129')).toBeInTheDocument();
  });

  it('applies syntax highlighting classes to code blocks', () => {
    const content = '```javascript\nconst answer = 42;\n```';
    const { container } = render(<MarkdownRender content={content} />);

    expect(container.querySelector('pre code')).toBeTruthy();
    expect(container.querySelector('code')).toHaveClass('hljs');
  });
});
