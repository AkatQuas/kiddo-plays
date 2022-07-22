import * as Common from "../../core/common/common.js";
import * as Root from "../../core/root/root.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
import { AttributionReportingIssue } from "./AttributionReportingIssue.js";
import { ClientHintIssue } from "./ClientHintIssue.js";
import { ContentSecurityPolicyIssue } from "./ContentSecurityPolicyIssue.js";
import { CorsIssue } from "./CorsIssue.js";
import { CrossOriginEmbedderPolicyIssue, isCrossOriginEmbedderPolicyIssue } from "./CrossOriginEmbedderPolicyIssue.js";
import { DeprecationIssue } from "./DeprecationIssue.js";
import { FederatedAuthRequestIssue } from "./FederatedAuthRequestIssue.js";
import { GenericIssue } from "./GenericIssue.js";
import { HeavyAdIssue } from "./HeavyAdIssue.js";
import { Events } from "./IssuesManagerEvents.js";
import { LowTextContrastIssue } from "./LowTextContrastIssue.js";
import { MixedContentIssue } from "./MixedContentIssue.js";
import { NavigatorUserAgentIssue } from "./NavigatorUserAgentIssue.js";
import { QuirksModeIssue } from "./QuirksModeIssue.js";
import { CookieIssue } from "./CookieIssue.js";
import { SharedArrayBufferIssue } from "./SharedArrayBufferIssue.js";
import { SourceFrameIssuesManager } from "./SourceFrameIssuesManager.js";
import { TrustedWebActivityIssue } from "./TrustedWebActivityIssue.js";
export { Events } from "./IssuesManagerEvents.js";
let issuesManagerInstance = null;
function createIssuesForBlockedByResponseIssue(issuesModel, inspectorIssue) {
  const blockedByResponseIssueDetails = inspectorIssue.details.blockedByResponseIssueDetails;
  if (!blockedByResponseIssueDetails) {
    console.warn("BlockedByResponse issue without details received.");
    return [];
  }
  if (isCrossOriginEmbedderPolicyIssue(blockedByResponseIssueDetails.reason)) {
    return [new CrossOriginEmbedderPolicyIssue(blockedByResponseIssueDetails, issuesModel)];
  }
  return [];
}
const issueCodeHandlers = /* @__PURE__ */ new Map([
  [
    Protocol.Audits.InspectorIssueCode.CookieIssue,
    CookieIssue.fromInspectorIssue
  ],
  [
    Protocol.Audits.InspectorIssueCode.MixedContentIssue,
    MixedContentIssue.fromInspectorIssue
  ],
  [
    Protocol.Audits.InspectorIssueCode.HeavyAdIssue,
    HeavyAdIssue.fromInspectorIssue
  ],
  [
    Protocol.Audits.InspectorIssueCode.ContentSecurityPolicyIssue,
    ContentSecurityPolicyIssue.fromInspectorIssue
  ],
  [Protocol.Audits.InspectorIssueCode.BlockedByResponseIssue, createIssuesForBlockedByResponseIssue],
  [
    Protocol.Audits.InspectorIssueCode.SharedArrayBufferIssue,
    SharedArrayBufferIssue.fromInspectorIssue
  ],
  [
    Protocol.Audits.InspectorIssueCode.TrustedWebActivityIssue,
    TrustedWebActivityIssue.fromInspectorIssue
  ],
  [
    Protocol.Audits.InspectorIssueCode.LowTextContrastIssue,
    LowTextContrastIssue.fromInspectorIssue
  ],
  [
    Protocol.Audits.InspectorIssueCode.CorsIssue,
    CorsIssue.fromInspectorIssue
  ],
  [
    Protocol.Audits.InspectorIssueCode.QuirksModeIssue,
    QuirksModeIssue.fromInspectorIssue
  ],
  [
    Protocol.Audits.InspectorIssueCode.NavigatorUserAgentIssue,
    NavigatorUserAgentIssue.fromInspectorIssue
  ],
  [
    Protocol.Audits.InspectorIssueCode.AttributionReportingIssue,
    AttributionReportingIssue.fromInspectorIssue
  ],
  [
    Protocol.Audits.InspectorIssueCode.GenericIssue,
    GenericIssue.fromInspectorIssue
  ],
  [
    Protocol.Audits.InspectorIssueCode.DeprecationIssue,
    DeprecationIssue.fromInspectorIssue
  ],
  [
    Protocol.Audits.InspectorIssueCode.ClientHintIssue,
    ClientHintIssue.fromInspectorIssue
  ],
  [
    Protocol.Audits.InspectorIssueCode.FederatedAuthRequestIssue,
    FederatedAuthRequestIssue.fromInspectorIssue
  ]
]);
function createIssuesFromProtocolIssue(issuesModel, inspectorIssue) {
  const handler = issueCodeHandlers.get(inspectorIssue.code);
  if (handler) {
    return handler(issuesModel, inspectorIssue);
  }
  console.warn(`No handler registered for issue code ${inspectorIssue.code}`);
  return [];
}
export var IssueStatus = /* @__PURE__ */ ((IssueStatus2) => {
  IssueStatus2["Hidden"] = "Hidden";
  IssueStatus2["Unhidden"] = "Unhidden";
  return IssueStatus2;
})(IssueStatus || {});
export function defaultHideIssueByCodeSetting() {
  const setting = {};
  return setting;
}
export function getHideIssueByCodeSetting() {
  return Common.Settings.Settings.instance().createSetting("HideIssueByCodeSetting-Experiment-2021", defaultHideIssueByCodeSetting());
}
export class IssuesManager extends Common.ObjectWrapper.ObjectWrapper {
  constructor(showThirdPartyIssuesSetting, hideIssueSetting) {
    super();
    this.showThirdPartyIssuesSetting = showThirdPartyIssuesSetting;
    this.hideIssueSetting = hideIssueSetting;
    new SourceFrameIssuesManager(this);
    SDK.TargetManager.TargetManager.instance().observeModels(SDK.IssuesModel.IssuesModel, this);
    SDK.FrameManager.FrameManager.instance().addEventListener(SDK.FrameManager.Events.TopFrameNavigated, this.#onTopFrameNavigated, this);
    SDK.FrameManager.FrameManager.instance().addEventListener(SDK.FrameManager.Events.FrameAddedToTarget, this.#onFrameAddedToTarget, this);
    this.showThirdPartyIssuesSetting?.addChangeListener(() => this.#updateFilteredIssues());
    if (Root.Runtime.experiments.isEnabled("hideIssuesFeature")) {
      this.hideIssueSetting?.addChangeListener(() => this.#updateFilteredIssues());
    }
  }
  #eventListeners = /* @__PURE__ */ new WeakMap();
  #allIssues = /* @__PURE__ */ new Map();
  #filteredIssues = /* @__PURE__ */ new Map();
  #issueCounts = /* @__PURE__ */ new Map();
  #hiddenIssueCount = /* @__PURE__ */ new Map();
  #hasSeenTopFrameNavigated = false;
  #issuesById = /* @__PURE__ */ new Map();
  static instance(opts = {
    forceNew: false,
    ensureFirst: false
  }) {
    if (issuesManagerInstance && opts.ensureFirst) {
      throw new Error('IssuesManager was already created. Either set "ensureFirst" to false or make sure that this invocation is really the first one.');
    }
    if (!issuesManagerInstance || opts.forceNew) {
      issuesManagerInstance = new IssuesManager(opts.showThirdPartyIssuesSetting, opts.hideIssueSetting);
    }
    return issuesManagerInstance;
  }
  static removeInstance() {
    issuesManagerInstance = null;
  }
  reloadForAccurateInformationRequired() {
    return !this.#hasSeenTopFrameNavigated;
  }
  #onTopFrameNavigated(event) {
    const { frame } = event.data;
    const keptIssues = /* @__PURE__ */ new Map();
    for (const [key, issue] of this.#allIssues.entries()) {
      if (issue.isAssociatedWithRequestId(frame.loaderId)) {
        keptIssues.set(key, issue);
      }
    }
    this.#allIssues = keptIssues;
    this.#hasSeenTopFrameNavigated = true;
    this.#updateFilteredIssues();
  }
  #onFrameAddedToTarget(event) {
    const { frame } = event.data;
    if (frame.isTopFrame()) {
      this.#updateFilteredIssues();
    }
  }
  modelAdded(issuesModel) {
    const listener = issuesModel.addEventListener(SDK.IssuesModel.Events.IssueAdded, this.#onIssueAddedEvent, this);
    this.#eventListeners.set(issuesModel, listener);
  }
  modelRemoved(issuesModel) {
    const listener = this.#eventListeners.get(issuesModel);
    if (listener) {
      Common.EventTarget.removeEventListeners([listener]);
    }
  }
  #onIssueAddedEvent(event) {
    const { issuesModel, inspectorIssue } = event.data;
    const issues = createIssuesFromProtocolIssue(issuesModel, inspectorIssue);
    for (const issue of issues) {
      this.addIssue(issuesModel, issue);
    }
  }
  addIssue(issuesModel, issue) {
    if (!issue.getDescription()) {
      return;
    }
    const primaryKey = issue.primaryKey();
    if (this.#allIssues.has(primaryKey)) {
      return;
    }
    this.#allIssues.set(primaryKey, issue);
    if (this.#issueFilter(issue)) {
      this.#filteredIssues.set(primaryKey, issue);
      this.#issueCounts.set(issue.getKind(), 1 + (this.#issueCounts.get(issue.getKind()) || 0));
      const issueId = issue.getIssueId();
      if (issueId) {
        this.#issuesById.set(issueId, issue);
      }
      const values = this.hideIssueSetting?.get();
      const hideIssuesFeature = Root.Runtime.experiments.isEnabled("hideIssuesFeature");
      if (hideIssuesFeature) {
        this.#updateIssueHiddenStatus(issue, values);
      }
      if (issue.isHidden()) {
        this.#hiddenIssueCount.set(issue.getKind(), 1 + (this.#hiddenIssueCount.get(issue.getKind()) || 0));
      }
      this.dispatchEventToListeners(Events.IssueAdded, { issuesModel, issue });
    }
    this.dispatchEventToListeners(Events.IssuesCountUpdated);
  }
  issues() {
    return this.#filteredIssues.values();
  }
  numberOfIssues(kind) {
    if (kind) {
      return (this.#issueCounts.get(kind) ?? 0) - this.numberOfHiddenIssues(kind);
    }
    return this.#filteredIssues.size - this.numberOfHiddenIssues();
  }
  numberOfHiddenIssues(kind) {
    if (kind) {
      return this.#hiddenIssueCount.get(kind) ?? 0;
    }
    let count = 0;
    for (const num of this.#hiddenIssueCount.values()) {
      count += num;
    }
    return count;
  }
  numberOfAllStoredIssues() {
    return this.#allIssues.size;
  }
  #issueFilter(issue) {
    return this.showThirdPartyIssuesSetting?.get() || !issue.isCausedByThirdParty();
  }
  #updateIssueHiddenStatus(issue, values) {
    const code = issue.code();
    if (values && values[code]) {
      if (values[code] === "Hidden" /* Hidden */) {
        issue.setHidden(true);
        return;
      }
      issue.setHidden(false);
      return;
    }
  }
  #updateFilteredIssues() {
    this.#filteredIssues.clear();
    this.#issueCounts.clear();
    this.#issuesById.clear();
    this.#hiddenIssueCount.clear();
    const values = this.hideIssueSetting?.get();
    const hideIssuesFeature = Root.Runtime.experiments.isEnabled("hideIssuesFeature");
    for (const [key, issue] of this.#allIssues) {
      if (this.#issueFilter(issue)) {
        if (hideIssuesFeature) {
          this.#updateIssueHiddenStatus(issue, values);
        }
        this.#filteredIssues.set(key, issue);
        this.#issueCounts.set(issue.getKind(), 1 + (this.#issueCounts.get(issue.getKind()) ?? 0));
        if (issue.isHidden()) {
          this.#hiddenIssueCount.set(issue.getKind(), 1 + (this.#hiddenIssueCount.get(issue.getKind()) || 0));
        }
        const issueId = issue.getIssueId();
        if (issueId) {
          this.#issuesById.set(issueId, issue);
        }
      }
    }
    this.dispatchEventToListeners(Events.FullUpdateRequired);
    this.dispatchEventToListeners(Events.IssuesCountUpdated);
  }
  unhideAllIssues() {
    for (const issue of this.#allIssues.values()) {
      issue.setHidden(false);
    }
    this.hideIssueSetting?.set(defaultHideIssueByCodeSetting());
  }
  getIssueById(id) {
    return this.#issuesById.get(id);
  }
}
globalThis.addIssueForTest = (issue) => {
  const mainTarget = SDK.TargetManager.TargetManager.instance().mainTarget();
  const issuesModel = mainTarget?.model(SDK.IssuesModel.IssuesModel);
  issuesModel?.issueAdded({ issue });
};
//# sourceMappingURL=IssuesManager.js.map
