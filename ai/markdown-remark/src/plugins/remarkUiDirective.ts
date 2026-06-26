import { visit } from 'unist-util-visit';
import remarkDirective from 'remark-directive';
import type { Root } from 'mdast';
import type { Plugin } from 'unified';
import type { Pluggable } from 'unified';
import {
  ALLOWED_UI_PROP_KEYS,
  KNOWN_UI_DIRECTIVES,
  type KnownUiDirective,
} from '../types';

type DirectiveAttributes =
  | Array<{ name?: string; value?: string }>
  | Record<string, string | null | undefined>
  | null
  | undefined;

type DirectiveNode = {
  type: string;
  name?: string;
  attributes?: DirectiveAttributes;
  children?: Array<{ type: string; value?: string }>;
  data?: {
    hName?: string;
    hProperties?: Record<string, string>;
    uiProps?: Record<string, string>;
  };
};

const DIRECTLY_VALUE_PATTERN = /^[\w\-./:@#\s\u4e00-\u9fff]+$/;

export function extractUiProps(
  attributes: DirectiveAttributes = [],
): Record<string, string> {
  const props: Record<string, string> = {};

  if (Array.isArray(attributes)) {
    for (const attr of attributes) {
      const name = attr.name?.trim();
      const value = attr.value?.trim();
      if (!name || !value || !ALLOWED_UI_PROP_KEYS.has(name)) {
        continue;
      }
      if (!DIRECTLY_VALUE_PATTERN.test(value)) {
        continue;
      }
      props[name] = value;
    }
    return props;
  }

  if (attributes && typeof attributes === 'object') {
    for (const [name, value] of Object.entries(attributes)) {
      const trimmed = value?.trim();
      if (!trimmed || !ALLOWED_UI_PROP_KEYS.has(name)) {
        continue;
      }
      if (!DIRECTLY_VALUE_PATTERN.test(trimmed)) {
        continue;
      }
      props[name] = trimmed;
    }
  }

  return props;
}

function isUiDirective(name?: string): name is KnownUiDirective {
  return (
    typeof name === 'string' &&
    name.startsWith('ui-') &&
    (KNOWN_UI_DIRECTIVES as readonly string[]).includes(name)
  );
}

function isUnknownUiDirective(name?: string): boolean {
  return typeof name === 'string' && name.startsWith('ui-') && !isUiDirective(name);
}

function degradeToParagraph(node: DirectiveNode): void {
  const rawParts: string[] = [`:::${node.name ?? ''}`];

  if (Array.isArray(node.attributes)) {
    for (const attr of node.attributes) {
      if (attr.name && attr.value) {
        rawParts.push(`${attr.name}="${attr.value}"`);
      }
    }
  } else if (node.attributes && typeof node.attributes === 'object') {
    for (const [name, value] of Object.entries(node.attributes)) {
      if (value) {
        rawParts.push(`${name}="${value}"`);
      }
    }
  }

  if (node.children?.length) {
    for (const child of node.children) {
      if (child.type === 'text' && child.value) {
        rawParts.push(child.value);
      }
    }
  }

  rawParts.push(':::');

  Object.assign(node, {
    type: 'paragraph',
    children: [{ type: 'text', value: rawParts.join(' ') }],
  });
}

export const remarkUiTransform: Plugin<[], Root> = () => (tree) => {
  visit(tree, (node) => {
    if (
      node.type !== 'containerDirective' &&
      node.type !== 'leafDirective' &&
      node.type !== 'textDirective'
    ) {
      return;
    }

    const directive = node as DirectiveNode;

    if (isUnknownUiDirective(directive.name)) {
      degradeToParagraph(directive);
      return;
    }

    if (!isUiDirective(directive.name)) {
      return;
    }

    const uiProps = extractUiProps(directive.attributes);
    directive.data = directive.data ?? {};
    directive.data.uiProps = uiProps;
    directive.data.hName = directive.name;
    directive.data.hProperties = {
      'data-ui-props': JSON.stringify(uiProps),
    };
  });
};

export const remarkUiDirectivePlugins: Pluggable[] = [
  remarkDirective,
  remarkUiTransform,
];

export default remarkUiTransform;
