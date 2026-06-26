import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownRender } from '../src/MarkdownRender';

const cardContent = `:::ui-card title="商品推荐" variant="primary" action="view:goods_1001"

- 无线蓝牙耳机 ￥199
- 机械键盘 ￥129
:::`;

describe('ui-card', () => {
  it('renders card with title, variant, and action props', () => {
    render(<MarkdownRender content={cardContent} />);

    const card = screen.getByTestId('ui-card');
    expect(card).toHaveAttribute('data-variant', 'primary');
    expect(card).toHaveAttribute('data-action', 'view:goods_1001');
    expect(screen.getByText('商品推荐')).toBeInTheDocument();
    expect(screen.getByText(/无线蓝牙耳机/)).toBeInTheDocument();
    expect(screen.getByText(/机械键盘/)).toBeInTheDocument();
  });

  it('triggers onAction when card is clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    render(<MarkdownRender content={cardContent} onAction={onAction} />);

    await user.click(screen.getByTestId('ui-card'));
    expect(onAction).toHaveBeenCalledWith('view:goods_1001');
  });
});
