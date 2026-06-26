import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownRender } from '../src/MarkdownRender';

const formContent = `:::ui-form field="phone" placeholder="请输入手机号" action="submit:user_info"
请填写联系电话用于发货
:::`;

describe('ui-form', () => {
  it('renders input with placeholder and field metadata', () => {
    render(<MarkdownRender content={formContent} />);

    const form = screen.getByTestId('ui-form');
    expect(form).toHaveAttribute('data-field', 'phone');
    expect(form).toHaveAttribute('data-action', 'submit:user_info');
    expect(screen.getByPlaceholderText('请输入手机号')).toBeInTheDocument();
    expect(screen.getByText('请填写联系电话用于发货')).toBeInTheDocument();
  });

  it('submits form and triggers onAction with field value', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    render(<MarkdownRender content={formContent} onAction={onAction} />);

    await user.type(screen.getByPlaceholderText('请输入手机号'), '13800138000');
    await user.click(screen.getByRole('button', { name: '提交' }));

    expect(onAction).toHaveBeenCalledWith('submit:user_info?phone=13800138000');
  });
});
