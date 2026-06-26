import type { FC } from 'react';
import type { UiComponentMap } from '../types';

export function parseUiProps(dataUiProps?: string): Record<string, string> {
  if (!dataUiProps) {
    return {};
  }
  try {
    const parsed = JSON.parse(dataUiProps) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // ignore malformed JSON
  }
  return {};
}

type UiElementProps = {
  'data-ui-props'?: string;
  children?: React.ReactNode;
};

export function createUiComponentRenderer<P extends Record<string, unknown>>(
  Component: FC<P>,
  uiComponents: UiComponentMap | undefined,
  componentKey: keyof UiComponentMap,
  onAction?: (action: string) => void
) {
  const Resolved = (uiComponents?.[componentKey] ?? Component) as FC<P>;

  return function UiRenderer({
    'data-ui-props': dataUiProps,
    children
  }: UiElementProps) {
    const props = parseUiProps(dataUiProps) as P;
    return (
      <Resolved {...props} onAction={onAction}>
        {children}
      </Resolved>
    );
  };
}
