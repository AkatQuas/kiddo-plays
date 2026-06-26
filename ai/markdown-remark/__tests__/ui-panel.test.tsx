import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownRender } from '../src/MarkdownRender';

const panelContent = `:::ui-panel title="订单操作面板"
:::ui-button label="取消订单" variant="default" action="cancel:order_88" :::
:::ui-button label="确认收货" variant="success" action="confirm:order_88" :::
:::`;

describe('ui-panel', () => {
  it('renders panel title and nested ui-buttons', () => {
    render(<MarkdownRender content={panelContent} />);

    expect(screen.getByTestId('ui-panel')).toBeInTheDocument();
    expect(screen.getByText('订单操作面板')).toBeInTheDocument();

    const buttons = screen.getAllByTestId('ui-button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveTextContent('取消订单');
    expect(buttons[1]).toHaveTextContent('确认收货');
    expect(buttons[0]).toHaveAttribute('data-action', 'cancel:order_88');
    expect(buttons[1]).toHaveAttribute('data-action', 'confirm:order_88');
  });

  it('degrades unknown ui directive to plain text', () => {
    render(
      <MarkdownRender
        content={':::ui-test title="x" :::'}
      />,
    );

    expect(screen.queryByTestId('ui-card')).not.toBeInTheDocument();
    expect(screen.getByText(/:::ui-test/)).toBeInTheDocument();
  });
});
