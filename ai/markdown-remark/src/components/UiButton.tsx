import type { UiButtonProps } from '../types';

export function UiButton({
  label,
  variant = 'default',
  action,
  onAction,
}: UiButtonProps) {
  const handleClick = () => {
    if (action && onAction) {
      onAction(action);
    }
  };

  return (
    <button
      type="button"
      className={`ui-button ui-button--${variant}`}
      data-testid="ui-button"
      data-action={action}
      data-variant={variant}
      onClick={handleClick}
    >
      {label ?? 'Button'}
    </button>
  );
}
