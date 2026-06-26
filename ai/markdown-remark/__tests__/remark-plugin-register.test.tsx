import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Root } from 'mdast';
import type { Plugin } from 'unified';
import { MarkdownRender } from '../src/MarkdownRender';

const appendMarkerPlugin: Plugin<[], Root> = () => (tree) => {
  tree.children.push({
    type: 'paragraph',
    children: [{ type: 'text', value: 'CUSTOM-MARKER' }],
  });
};

const orderTracker: string[] = [];

const orderPlugin: Plugin<[], Root> = () => (tree) => {
  orderTracker.push('external');
  return tree;
};

describe('remark plugin registration', () => {
  it('executes custom remark plugins and modifies output', () => {
    render(
      <MarkdownRender
        content="hello"
        remarkPlugins={[appendMarkerPlugin]}
      />,
    );

    expect(screen.getByText('CUSTOM-MARKER')).toBeInTheDocument();
  });

  it('runs external plugins before built-in ui directive plugin', () => {
    orderTracker.length = 0;

    render(
      <MarkdownRender
        content={':::ui-button label="Go" action="switch:test" :::'}
        remarkPlugins={[orderPlugin]}
      />,
    );

    expect(orderTracker).toContain('external');
    expect(screen.getByTestId('ui-button')).toBeInTheDocument();
  });

  it('does not crash when an invalid plugin throws', () => {
    const badPlugin: Plugin<[], Root> = () => () => {
      throw new Error('plugin failed');
    };

    expect(() =>
      render(
        <MarkdownRender content="safe content: **bold**" remarkPlugins={[badPlugin]} />,
      ),
    ).not.toThrow();

    expect(screen.getByText(/safe content/)).toBeInTheDocument();
  });

  it('allows overriding default ui components', () => {
    function CustomButton({ label }: { label?: string }) {
      return <button data-testid="custom-button">{label}</button>;
    }

    render(
      <MarkdownRender
        content={':::ui-button label="Custom" action="switch:x" :::'}
        uiComponents={{ UiButton: CustomButton }}
      />,
    );

    expect(screen.getByTestId('custom-button')).toHaveTextContent('Custom');
  });
});
