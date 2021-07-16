import emptyObject from 'fbjs/lib/emptyObject';
import ReactReconciler from 'react-reconciler';
import { createElement } from './createElement';

/**
 * create a reconciler instance using a host config object
 *
 * React will manage all the non-host components, stateless and composites.
 */
export const CustomRenderer = ReactReconciler({
  appendInitialChild(parentInstance, child) {
    if (parentInstance.appendChild) {
      parentInstance.appendChild(child);
    } else {
      parentInstance.document = child;
    }
  },

  createInstance(type, props, rootContainer, hostContext, internalHandle) {
    return createElement(
      type,
      props,
      rootContainer,
      hostContext,
      internalHandle
    );
  },

  /**
   * creates an instance of a text node
   * @param {*} text
   * @param {*} rootContainer
   * @param {*} hostContext
   * @param {*} internalHandle
   * @returns
   */
  createTextInstance(text, rootContainer, hostContext, internalHandle) {
    return text;
  },

  finalizeInitialChildren(instance, type, props, rootContainer, hostContext) {
    return false;
  },

  /**
   * This is an identity relation which means that it alawys returns the same value
   * that was used as its argument.
   * This could be used for the TestRenderer.
   * @param {*} instance
   * @returns
   */
  getPublicInstance(instance) {
    return instance;
  },

  prepareForCommit(containerInfo) {},

  /**
   * prepareUpdate computes the diff for an instance
   * @param {*} instance
   * @param {*} type
   * @param {*} oldProps
   * @param {*} newProps
   * @param {*} rootContainer
   * @param {*} hostContext
   */
  prepareUpdate(
    instance,
    type,
    oldProps,
    newProps,
    rootContainer,
    hostContext
  ) {},

  /**
   * Commit the update or apply the diff calculated to the host environment's node
   * @param {*} instance
   * @param {*} updatePayload
   * @param {*} type
   * @param {*} prevProps
   * @param {*} nextProps
   * @param {*} internalHandle
   */
  commitUpdate(
    instance,
    updatePayload,
    type,
    prevProps,
    nextProps,
    internalHandle
  ) {},

  /**
   * Renderer mounts the host component but may schedule some work to done after.
   * The host components are only mounted when there is no current/alternate fiber.
   * @param {*} instance
   * @param {*} type
   * @param {*} props
   * @param {*} internalInstanceHandle
   */
  commitMount(instance, type, props, internalInstanceHandle) {},

  resetAfterCommit(containerInfo) {},

  /**
   * Reset the text content of the parent before doing any insertions
   * @param {*} instance
   */
  resetTextContent(instance) {},

  /**
   * It commits the update payload for the text nodes.
   * @param {*} textInstance
   * @param {*} oldText
   * @param {*} newText
   */
  commitTextUpdate(textInstance, oldText, newText) {},

  /**
   * Mark the current host context (root instance) which is sent to update
   * the payload and therefore update the queue of work in progress fiber
   * @param {*} rootContainer
   */
  getRootHostContext(rootContainer) {},

  getChildHostContext(parentHostContext, type, rootContainer) {
    return emptyObject;
  },

  /**
   * remove the node from the tree, parent fiber is any node but container
   * @param {*} parentInstance
   * @param {*} child
   */
  removeChild(parentInstance, child) {},

  /**
   * remove the node from the tree, parent fiber is container
   * @param {*} container
   * @param {*} child
   */
  removeChildFromContainer(container, child) {},

  /**
   * This is called when all the nodes are recursively inserted into parent.
   *
   * @param {*} parentInstance
   * @param {*} child
   * @param {*} beforeChild
   */
  insertBefore(parentInstance, child, beforeChild) {},

  /**
   * The type of fiber is a HostRoot or HostPortal, then the child is added to that container.
   * @param {*} container
   * @param {*} child
   */
  appendChildToContainer(container, child) {},

  /**
   * Child is added to the parent.
   * @param {*} parentInstance
   * @param {*} child
   */
  appendChild(parentInstance, child) {},

  /**
   * If it returns false then schedule the text content to be reset.
   * @param {*} type
   * @param {*} props
   * @returns
   */
  shouldSetTextContent(type, props) {
    return false;
  },

  /**
   * True for mutating renderers where the host target has mutative api like `appendChild` in DOM
   */
  supportsMutation: false,
});
