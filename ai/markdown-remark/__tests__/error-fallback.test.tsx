import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownRender } from '../src/MarkdownRender';
import { extractUiProps } from '../src/plugins/remarkUiDirective';

describe('error fallback', () => {
  it('renders unclosed ui marker as raw text without crashing', () => {
    const content = `:::ui-card title="broken"

- item one`;

    expect(() => render(<MarkdownRender content={content} />)).not.toThrow();
    expect(screen.getByText(/:::ui-card/)).toBeInTheDocument();
  });

  it('filters illegal attribute values and keeps valid fields', () => {
    const props = extractUiProps([
      { name: 'title', value: 'valid title' },
      { name: 'action', value: 'view:1001' },
      { name: 'variant', value: 'primary<script>' },
      { name: 'unknown', value: 'ignored' },
    ]);

    expect(props).toEqual({
      title: 'valid title',
      action: 'view:1001',
    });
  });

  it('renders safely when action is empty and click does not throw', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    render(
      <MarkdownRender
        content={':::ui-button label="No Action" action="" :::'}
        onAction={onAction}
      />,
    );

    await user.click(screen.getByTestId('ui-button'));
    expect(onAction).not.toHaveBeenCalled();
  });

  it('renders invalid action without errors on click', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    render(
      <MarkdownRender
        content={':::ui-button label="Bad" action="invalid" :::'}
        onAction={onAction}
      />,
    );

    await user.click(screen.getByTestId('ui-button'));
    expect(onAction).toHaveBeenCalledWith('invalid');
  });
});
