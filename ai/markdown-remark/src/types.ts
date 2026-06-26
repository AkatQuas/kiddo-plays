import type { PluggableList } from 'unified';
import type { FC, ReactNode } from 'react';

export type UiVariant = 'primary' | 'default' | 'success';

export type UiProps = Record<string, string>;

export interface UiComponentBaseProps {
  children?: ReactNode;
  onAction?: (action: string) => void;
  variant?: UiVariant;
  action?: string;
}

export interface UiCardProps extends UiComponentBaseProps {
  title?: string;
}

export interface UiButtonProps extends UiComponentBaseProps {
  label?: string;
}

export interface UiFormProps extends UiComponentBaseProps {
  field?: string;
  placeholder?: string;
}

export interface UiPanelProps extends UiComponentBaseProps {
  title?: string;
}

export type UiComponentMap = {
  UiCard?: FC<UiCardProps>;
  UiButton?: FC<UiButtonProps>;
  UiForm?: FC<UiFormProps>;
  UiPanel?: FC<UiPanelProps>;
};

export type MarkdownRenderProps = {
  content: string;
  remarkPlugins?: PluggableList;
  rehypePlugins?: PluggableList;
  uiComponents?: UiComponentMap;
  onAction?: (actionStr: string) => void;
  className?: string;
};

export const KNOWN_UI_DIRECTIVES = [
  'ui-card',
  'ui-button',
  'ui-form',
  'ui-panel',
] as const;

export type KnownUiDirective = (typeof KNOWN_UI_DIRECTIVES)[number];

export const UI_TAG_TO_COMPONENT_KEY: Record<
  KnownUiDirective,
  keyof UiComponentMap
> = {
  'ui-card': 'UiCard',
  'ui-button': 'UiButton',
  'ui-form': 'UiForm',
  'ui-panel': 'UiPanel',
};

export const ALLOWED_UI_PROP_KEYS = new Set([
  'title',
  'label',
  'field',
  'placeholder',
  'variant',
  'action',
]);
