import { visit } from 'unist-util-visit';
import type { Root, Element } from 'hast';

const UI_TAGS = new Set(['ui-card', 'ui-button', 'ui-form', 'ui-panel']);

export function rehypeUiBlock() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (
        index == null ||
        !parent ||
        parent.type !== 'element' ||
        parent.tagName !== 'p'
      ) {
        return;
      }

      if (!UI_TAGS.has(node.tagName)) {
        return;
      }

      const siblings = parent.children;
      const onlyUi =
        siblings.length === 1 &&
        siblings[0].type === 'element' &&
        UI_TAGS.has((siblings[0] as Element).tagName);

      if (onlyUi) {
        Object.assign(parent, {
          tagName: node.tagName,
          properties: node.properties,
          children: node.children,
        });
        return;
      }

      parent.children.splice(index, 1, {
        type: 'element',
        tagName: 'div',
        properties: { className: 'ui-block-wrapper' },
        children: [node],
      });
    });
  };
}

export default rehypeUiBlock;
