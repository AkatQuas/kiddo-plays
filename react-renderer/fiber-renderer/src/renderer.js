import ReactReconciler from 'react-reconciler';

let count = 111;
function nextCount() {
  return `prepareCommit${count++}`;
}

function noop() {}

/**
 * @type {ReactReconciler.HostConfig}
 */
const HostConfig = {
  /**
   * This function is used to calculate current time for prioritising work.
   */
  now: performance.now,
  supportsMutation: true,
  /**
   * Initial host context from the root of the tree
   * Share some context with the other functions in this HostConfig
   */
  getRootHostContext(rootContainer) {
    console.log(`rootContainer is`, rootContainer);
    return {
      __hostContext: true,
    };
  },
  getChildHostContext(parentHostContext, fiberType, rootContainer) {
    console.log(`parentHostContext`, parentHostContext);
    console.log(`fiberType`, fiberType);
    console.log(`rootContainer`, rootContainer);
    return {
      __hostContext: parentHostContext,
      __childContext: true,
      __type: fiberType,
    };
  },
  /**
   * If you return `true` from this method,
   * React will assume that this node's children are text,
   * and will not create nodes for them.
   * It will instead rely on you to have filled that text during `createInstance`.
   * This is a performance optimization.
   *
   * For example, the DOM renderer returns `true` only if type is a known text-only parent (like 'textarea') or if `props.children` has a 'string' type.
   * If you return true, you will need to implement `resetTextContent` too.
   *
   * If you don't want to do anything here, you should return `false`.
   */
  shouldSetTextContent(type, props) {
    console.log(`type`, type);
    console.log(`props`, props);
    // custom renderer implementation
    return false;

    // react-dom implementation
    // return (
    //   type === 'textarea' ||
    //   type === 'option' ||
    //   type === 'noscript' ||
    //   typeof props.children === 'string' ||
    //   typeof props.children === 'number' ||
    //   (typeof props.dangerouslySetInnerHTML === 'object' &&
    //     props.dangerouslySetInnerHTML !== null &&
    //     props.dangerouslySetInnerHTML.__html != null)
    // );
  },
  resetTextContent(instance) {
    console.log(`instance`, instance);
  },
  createInstance(type, props, rootContainer, hostContext, internalHandle) {
    console.log(`type`, type);
    console.log(`props`, props);
    console.log(`rootContainer`, rootContainer);
    console.log(`hostContext`, hostContext);
    console.log(`internalHandle`, internalHandle);
    const element = document.createElement(type);
    ['alt', 'className', 'href', 'rel', 'src', 'target', 'style'].forEach(
      (k) => {
        if (props[k]) {
          element[k] = props[k];
        }
      }
    );
    if (props.onClick) {
      element.addEventListener('click', props.onClick);
    }
    return element;
  },
  createTextInstance(text, rootContainer, currentHostContext, internalHandle) {
    // text string to be rendered
    console.log(`text`, text);
    console.log(`rootContainer`, rootContainer);
    console.log(`currentHostContext`, currentHostContext);
    console.log(`internalHandle`, internalHandle);
    // return the actual text view element.
    // in the custome renderer, return a TextNode
    return document.createTextNode(text);
  },
  appendInitialChild(parentInstance, child) {
    console.log(`parentInstance`, parentInstance);
    console.log(`child`, child);
    parentInstance.appendChild(child);
  },
  appendChild(parentInstance, child) {
    console.log(`parentInstance`, parentInstance);
    console.log(`child`, child);
    parentInstance.appendChild(child);
  },
  /**
   * Attach node to root container.
   */
  appendChildToContainer(container, child) {
    console.log(`container`, container);
    console.log(`child`, child);
    container.appendChild(child);
  },
  insertBefore(parentInstance, child, beforeChild) {
    console.log(`parentInstance`, parentInstance);
    console.log(`child`, child);
    console.log(`beforeChild`, beforeChild);
    parentInstance.insertBefore(child, beforeChild);
  },
  insertInContainerBefore(container, child, beforeChild) {
    console.log(`container`, container);
    console.log(`child`, child);
    console.log(`beforeChild`, beforeChild);
    container.insertBefore(child, beforeChild);
  },
  finalizeInitialChildren(instance, type, props, rootContainer, hostContext) {
    console.log(`instance`, instance);
    console.log(`type`, type);
    console.log(`props`, props);
    console.log(`rootContainer`, rootContainer);
    console.log(`hostContext`, hostContext);

    // Return Value A boolean value which decides
    // if `commitMount` for this element needs to be called.
    return props.autoFocus;
  },
  /**
   * This method is called after all the steps are done (ie after resetAfterCommit),
   * meaning the entire tree has been attached to the dom.
   */
  commitMount(instance, type, nextProps, internalInstanceHandle) {
    console.log(`instance`, instance);
    console.log(`type`, type);
    console.log(`nextProps`, nextProps);
    console.log(`internalInstanceHandle`, internalInstanceHandle);
    if (nextProps.autoFocus) {
      instance.focus();
    }
  },
  clearContainer(container) {
    console.log(`container`, container);
    container.innerHTML = '';
  },
  removeChild(parentInstance, child) {
    console.log(`parentInstance`, parentInstance);
    console.log(`child`, child);
    parentInstance.removeChild(child);
  },
  removeChildFromContainer(container, child) {
    console.log(`container`, container);
    console.log(`child`, child);
    container.removeChild(child);
  },
  prepareUpdate(
    instance,
    type,
    prevProps,
    nextProps,
    rootContainer,
    hostContext
  ) {
    console.log(`instance`, instance);
    console.log(`type`, type);
    console.log(`prevProps`, prevProps);
    console.log(`nextProps`, nextProps);
    console.log(`rootContainer`, rootContainer);
    console.log(`hostContext`, hostContext);
    /* update payload, information on what nneds to be changed on this host element */
    return null;
  },
  /**
   * Perform all updates that we queued using prepareUpdate method
   */
  commitUpdate(
    instance,
    updatePayload,
    type,
    prevProps,
    nextProps,
    internalHandle
  ) {
    console.log(`instance`, instance);
    console.log(`updatePayload`, updatePayload);
    console.log(`type`, type);
    console.log(`prevProps`, prevProps);
    console.log(`nextProps`, nextProps);
    console.log(`internalHandle`, internalHandle);
    return null;
  },
  commitTextUpdate(textInstance, oldText, newText) {
    /* perform dom update on textInstance */
    console.log(`textInstance`, textInstance);
    console.log(`oldText`, oldText);
    console.log(`newText`, newText);
    textInstance.nodeValue = newText;
  },
  /**
   * Here we can do any preparation that needs to be done
   * on the rootContainer before attaching the in memory render tree.
   */
  prepareForCommit(containerInfo) {
    console.log(`containerInfo`, containerInfo);
    const commitId = nextCount();
    console.log(`next commit id`, commitId);
    containerInfo.dataset.commitId = commitId;

    /* https://github.com/facebook/react/issues/19582 */
    return null;
  },
  /**
   * Here we can do any post attach operations that needs to be done
   */
  resetAfterCommit(containerInfo) {
    console.log(`containerInfo`, containerInfo);
  },
  getPublicInstance(instance) {
    console.log(`instance`, instance);
    return instance;
  },
};

const LoggedHostConfig = () => {
  return Object.entries(HostConfig).reduce((acc, [key, value]) => {
    if (typeof value === 'function') {
      acc[key] = (...args) => {
        console.group(key);
        const result = value(...args);
        console.groupEnd(key);
        return result;
      };
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});
};

const reconciler = ReactReconciler(LoggedHostConfig());

export const CustomRenderer = {
  /**
   *
   * @param {*} element react element for App component
   * @param {*} renderDom the host root element to which the rendered app will be attached
   * @param {*} callback if specified will be called after render is done
   */
  render(element, renderDom, callback) {
    console.log(`CustomRenderer render with ->`, element, renderDom, callback);

    // create the root fiber node
    const container = reconciler.createContainer(renderDom, false, false, noop);

    // no parent for the root fiber
    const parentComponent = null;
    // start reconciler and render the result
    reconciler.updateContainer(element, container, parentComponent, callback);
  },
};
