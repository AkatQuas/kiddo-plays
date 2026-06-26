import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownRender } from '../src/MarkdownRender';

describe('ui-button', () => {
  it('renders button label and action attributes', () => {
    render(
      <MarkdownRender
        content={':::ui-button label="查看订单" variant="primary" action="switch:order_detail" :::'}
      />,
    );

    const button = screen.getByTestId('ui-button');
    expect(button).toHaveTextContent('查看订单');
    expect(button).toHaveAttribute('data-action', 'switch:order_detail');
    expect(button).toHaveAttribute('data-variant', 'primary');
  });

  it('calls onAction with action string on click', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    render(
      <MarkdownRender
        content={':::ui-button label="查看订单" action="switch:order_detail" :::'}
        onAction={onAction}
      />,
    );

    await user.click(screen.getByTestId('ui-button'));
    expect(onAction).toHaveBeenCalledWith('switch:order_detail');
  });
});
