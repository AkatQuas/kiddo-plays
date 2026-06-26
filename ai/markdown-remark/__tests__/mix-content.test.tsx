import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownRender } from '../src/MarkdownRender';

describe('mixed markdown and ui content', () => {
  it('renders native markdown alongside ui-card', () => {
    const content = `### 我的订单

这里是订单基础信息
:::ui-card title="订单1001" action="view:1001"

- 商品：机械键盘
- 金额：129元
:::`;

    render(<MarkdownRender content={content} />);

    expect(screen.getByRole('heading', { level: 3, name: '我的订单' })).toBeInTheDocument();
    expect(screen.getByText('这里是订单基础信息')).toBeInTheDocument();
    expect(screen.getByTestId('ui-card')).toHaveAttribute('data-action', 'view:1001');
    expect(screen.getByText(/机械键盘/)).toBeInTheDocument();
  });

  it('renders multiple consecutive ui components on separate lines', () => {
    const content = `:::ui-button label="按钮A" action="switch:a" :::
:::ui-button label="按钮B" action="switch:b" :::`;

    render(<MarkdownRender content={content} />);

    const buttons = screen.getAllByTestId('ui-button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveTextContent('按钮A');
    expect(buttons[1]).toHaveTextContent('按钮B');
  });
});
