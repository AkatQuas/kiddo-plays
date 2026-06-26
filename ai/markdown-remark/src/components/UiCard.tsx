import type { UiCardProps } from '../types';

export function UiCard({
  title,
  variant = 'default',
  action,
  onAction,
  children,
}: UiCardProps) {
  const handleClick = () => {
    if (action && onAction) {
      onAction(action);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={`ui-card ui-card--${variant}`}
      data-testid="ui-card"
      data-action={action}
      data-variant={variant}
      role={action ? 'button' : undefined}
      tabIndex={action ? 0 : undefined}
      onClick={action ? handleClick : undefined}
      onKeyDown={action ? handleKeyDown : undefined}
    >
      {title ? <div className="ui-card__title">{title}</div> : null}
      <div className="ui-card__body">{children}</div>
    </div>
  );
}
