import type { UiPanelProps } from '../types';

export function UiPanel({ title, children }: UiPanelProps) {
  return (
    <div className="ui-panel" data-testid="ui-panel">
      {title ? <div className="ui-panel__title">{title}</div> : null}
      <div className="ui-panel__body">{children}</div>
    </div>
  );
}
