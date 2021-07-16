export function createElement(
  type,
  props,
  rootContainer,
  hostContext,
  internalHandle
) {
  switch (type) {
    case 'ROOT':
      return {};
    case 'TEXT':
      return new Text(props, rootContainer);
    default:
      return undefined;
  }
}

class Text {
  constructor(props, root) {
    this.props = props;
    this.root = root;
    this.text = '';
  }

  appendChild(child) {
    if (typeof child === 'string') {
      this.text = this.text + child;
    }
  }
}
