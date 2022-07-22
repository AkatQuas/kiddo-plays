import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import debuggerPausedMessageStyles from "./debuggerPausedMessage.css.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as Protocol from "../../generated/protocol.js";
const UIStrings = {
  pausedOnS: "Paused on {PH1}",
  childSAdded: "Child {PH1} added",
  descendantSAdded: "Descendant {PH1} added",
  descendantSRemoved: "Descendant {PH1} removed",
  pausedOnEventListener: "Paused on event listener",
  pausedOnXhrOrFetch: "Paused on XHR or fetch",
  pausedOnException: "Paused on exception",
  pausedOnPromiseRejection: "Paused on `promise` rejection",
  pausedOnAssertion: "Paused on assertion",
  pausedOnDebuggedFunction: "Paused on debugged function",
  pausedBeforePotentialOutofmemory: "Paused before potential out-of-memory crash",
  pausedOnCspViolation: "Paused on CSP violation",
  trustedTypeSinkViolation: "`Trusted Type` Sink Violation",
  trustedTypePolicyViolation: "`Trusted Type` Policy Violation",
  pausedOnBreakpoint: "Paused on breakpoint",
  debuggerPaused: "Debugger paused",
  subtreeModifications: "subtree modifications",
  attributeModifications: "attribute modifications",
  nodeRemoval: "node removal"
};
const str_ = i18n.i18n.registerUIStrings("panels/sources/DebuggerPausedMessage.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
export class DebuggerPausedMessage {
  elementInternal;
  contentElement;
  constructor() {
    this.elementInternal = document.createElement("div");
    this.elementInternal.classList.add("paused-message");
    this.elementInternal.classList.add("flex-none");
    const root = UI.Utils.createShadowRootWithCoreStyles(this.elementInternal, { cssFile: [debuggerPausedMessageStyles], delegatesFocus: void 0 });
    this.contentElement = root.createChild("div");
    UI.ARIAUtils.markAsPoliteLiveRegion(this.elementInternal, false);
  }
  element() {
    return this.elementInternal;
  }
  static descriptionWithoutStack(description) {
    const firstCallFrame = /^\s+at\s/m.exec(description);
    return firstCallFrame ? description.substring(0, firstCallFrame.index - 1) : description.substring(0, description.lastIndexOf("\n"));
  }
  static async createDOMBreakpointHitMessage(details) {
    const messageWrapper = document.createElement("span");
    const domDebuggerModel = details.debuggerModel.target().model(SDK.DOMDebuggerModel.DOMDebuggerModel);
    if (!details.auxData || !domDebuggerModel) {
      return messageWrapper;
    }
    const data = domDebuggerModel.resolveDOMBreakpointData(details.auxData);
    if (!data) {
      return messageWrapper;
    }
    const mainElement = messageWrapper.createChild("div", "status-main");
    mainElement.appendChild(UI.Icon.Icon.create("smallicon-clear-info", "status-icon"));
    const breakpointType = BreakpointTypeNouns.get(data.type);
    mainElement.appendChild(document.createTextNode(i18nString(UIStrings.pausedOnS, { PH1: breakpointType ? breakpointType() : String(null) })));
    const subElement = messageWrapper.createChild("div", "status-sub monospace");
    const linkifiedNode = await Common.Linkifier.Linkifier.linkify(data.node);
    subElement.appendChild(linkifiedNode);
    if (data.targetNode) {
      const targetNodeLink = await Common.Linkifier.Linkifier.linkify(data.targetNode);
      let messageElement;
      if (data.insertion) {
        if (data.targetNode === data.node) {
          messageElement = i18n.i18n.getFormatLocalizedString(str_, UIStrings.childSAdded, { PH1: targetNodeLink });
        } else {
          messageElement = i18n.i18n.getFormatLocalizedString(str_, UIStrings.descendantSAdded, { PH1: targetNodeLink });
        }
      } else {
        messageElement = i18n.i18n.getFormatLocalizedString(str_, UIStrings.descendantSRemoved, { PH1: targetNodeLink });
      }
      subElement.appendChild(document.createElement("br"));
      subElement.appendChild(messageElement);
    }
    return messageWrapper;
  }
  async render(details, debuggerWorkspaceBinding, breakpointManager) {
    this.contentElement.removeChildren();
    this.contentElement.hidden = !details;
    if (!details) {
      return;
    }
    const status = this.contentElement.createChild("div", "paused-status");
    const errorLike = details.reason === Protocol.Debugger.PausedEventReason.Exception || details.reason === Protocol.Debugger.PausedEventReason.PromiseRejection || details.reason === Protocol.Debugger.PausedEventReason.Assert || details.reason === Protocol.Debugger.PausedEventReason.OOM;
    let messageWrapper;
    if (details.reason === Protocol.Debugger.PausedEventReason.DOM) {
      messageWrapper = await DebuggerPausedMessage.createDOMBreakpointHitMessage(details);
    } else if (details.reason === Protocol.Debugger.PausedEventReason.EventListener) {
      let eventNameForUI = "";
      if (details.auxData) {
        const maybeNonDomEventNameForUI = SDK.EventBreakpointsModel.EventBreakpointsManager.instance().resolveEventListenerBreakpointTitle(details.auxData);
        if (maybeNonDomEventNameForUI) {
          eventNameForUI = maybeNonDomEventNameForUI;
        } else {
          eventNameForUI = SDK.DOMDebuggerModel.DOMDebuggerManager.instance().resolveEventListenerBreakpointTitle(details.auxData);
        }
      }
      messageWrapper = buildWrapper(i18nString(UIStrings.pausedOnEventListener), eventNameForUI);
    } else if (details.reason === Protocol.Debugger.PausedEventReason.XHR) {
      const auxData = details.auxData;
      messageWrapper = buildWrapper(i18nString(UIStrings.pausedOnXhrOrFetch), auxData.url || "");
    } else if (details.reason === Protocol.Debugger.PausedEventReason.Exception) {
      const auxData = details.auxData;
      const description = auxData.description || auxData.value || "";
      const descriptionWithoutStack = DebuggerPausedMessage.descriptionWithoutStack(description);
      messageWrapper = buildWrapper(i18nString(UIStrings.pausedOnException), descriptionWithoutStack, description);
    } else if (details.reason === Protocol.Debugger.PausedEventReason.PromiseRejection) {
      const auxData = details.auxData;
      const description = auxData.description || auxData.value || "";
      const descriptionWithoutStack = DebuggerPausedMessage.descriptionWithoutStack(description);
      messageWrapper = buildWrapper(i18nString(UIStrings.pausedOnPromiseRejection), descriptionWithoutStack, description);
    } else if (details.reason === Protocol.Debugger.PausedEventReason.Assert) {
      messageWrapper = buildWrapper(i18nString(UIStrings.pausedOnAssertion));
    } else if (details.reason === Protocol.Debugger.PausedEventReason.DebugCommand) {
      messageWrapper = buildWrapper(i18nString(UIStrings.pausedOnDebuggedFunction));
    } else if (details.reason === Protocol.Debugger.PausedEventReason.OOM) {
      messageWrapper = buildWrapper(i18nString(UIStrings.pausedBeforePotentialOutofmemory));
    } else if (details.reason === Protocol.Debugger.PausedEventReason.CSPViolation && details.auxData && details.auxData["violationType"]) {
      const text = details.auxData["violationType"];
      if (text === Protocol.DOMDebugger.CSPViolationType.TrustedtypeSinkViolation) {
        messageWrapper = buildWrapper(i18nString(UIStrings.pausedOnCspViolation), i18nString(UIStrings.trustedTypeSinkViolation));
      } else if (text === Protocol.DOMDebugger.CSPViolationType.TrustedtypePolicyViolation) {
        messageWrapper = buildWrapper(i18nString(UIStrings.pausedOnCspViolation), i18nString(UIStrings.trustedTypePolicyViolation));
      }
    } else if (details.callFrames.length) {
      const uiLocation = await debuggerWorkspaceBinding.rawLocationToUILocation(details.callFrames[0].location());
      const breakpoint = uiLocation ? breakpointManager.findBreakpoint(uiLocation) : null;
      const defaultText = breakpoint ? i18nString(UIStrings.pausedOnBreakpoint) : i18nString(UIStrings.debuggerPaused);
      messageWrapper = buildWrapper(defaultText);
    } else {
      console.warn("ScriptsPanel paused, but callFrames.length is zero.");
    }
    status.classList.toggle("error-reason", errorLike);
    if (messageWrapper) {
      status.appendChild(messageWrapper);
    }
    function buildWrapper(mainText, subText, title) {
      const messageWrapper2 = document.createElement("span");
      const mainElement = messageWrapper2.createChild("div", "status-main");
      const icon = UI.Icon.Icon.create(errorLike ? "smallicon-clear-error" : "smallicon-clear-info", "status-icon");
      mainElement.appendChild(icon);
      mainElement.appendChild(document.createTextNode(mainText));
      if (subText) {
        const subElement = messageWrapper2.createChild("div", "status-sub monospace");
        subElement.textContent = subText;
        UI.Tooltip.Tooltip.install(subElement, title || subText);
      }
      return messageWrapper2;
    }
  }
}
export const BreakpointTypeNouns = /* @__PURE__ */ new Map([
  [Protocol.DOMDebugger.DOMBreakpointType.SubtreeModified, i18nLazyString(UIStrings.subtreeModifications)],
  [Protocol.DOMDebugger.DOMBreakpointType.AttributeModified, i18nLazyString(UIStrings.attributeModifications)],
  [Protocol.DOMDebugger.DOMBreakpointType.NodeRemoved, i18nLazyString(UIStrings.nodeRemoval)]
]);
//# sourceMappingURL=DebuggerPausedMessage.js.map
