import ReactReconciler from 'react-reconciler';
function noop() {}

/**
 * configuration for how to talk to the host env
 * aka "host config"
 */
const reconciler = ReactReconciler({
  supportsMutation: true,
  createInstance(type, props, rootContainer, hostContext, internalHandle) {
    // console.log(type, props);
    let element = document.createElement(type);
    ['alt', 'className', 'href', 'rel', 'src', 'target'].forEach((k) => {
      if (props[k]) {
        element[k] = props[k];
      }
    });
    if (props.onClick) {
      element.addEventListener('click', props.onClick);
    }

    if (props.bgColor) {
      element.style.backgroundColor = props.bgColor;
    }
    return element;
  },
  createTextInstance(text, rootContainer, hostContext, internalHandle) {
    return document.createTextNode(text);
  },
  appendChildToContainer(container, child) {
    container.appendChild(child);
  },
  appendChild(parentInstance, child) {
    parentInstance.appendChild(child);
  },
  appendInitialChild(parentInstance, child) {
    parentInstance.appendChild(child);
  },

  removeChildFromContainer(container, child) {
    container.removeChild(child);
  },
  removeChild(parentInstance, child) {
    parentInstance.removeChild(child);
  },
  insertInContainerBefore(container, child, beforeChild) {
    container.insertBefore(child, beforeChild);
  },
  insertBefore(parentInstance, child, beforeChild) {
    parentInstance.insertBefore(child, beforeChild);
  },
  prepareUpdate(
    instance,
    type,
    oldProps,
    newProps,
    rootContainer,
    hostContext
  ) {
    let payload;
    if (oldProps.bgColor !== newProps.bgColor) {
      payload = { newBgColor: newProps.bgColor };
    }
    return payload;
  },
  commitUpdate(
    instance,
    updatePayload,
    type,
    prevProps,
    nextProps,
    internalHandle
  ) {
    if (updatePayload.newBgColor) {
      instance.style.backgroundColor = updatePayload.newBgColor;
    }
  },

  finalizeInitialChildren(instance, type, props, rootContainer, hostContext) {},
  getChildHostContext(parentHostContext, type, rootContainer) {},
  getPublicInstance(instance) {},
  getRootHostContext(rootContainer) {},
  prepareForCommit(containerInfo) {
    return null;
  },
  resetAfterCommit(containerInfo) {},
  shouldSetTextContent(type, props) {
    return false;
  },
});

const ReactDOMMini = {
  render(whatToRender, div) {
    // creates root fiber node
    const container = reconciler.createContainer(div, false, false, noop);
    // start reconciler and render the result
    reconciler.updateContainer(whatToRender, container, null, null);
  },
};

export default ReactDOMMini;
