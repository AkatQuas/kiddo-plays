import { StackTrace } from "./StackTrace.js";
import { PermissionsPolicySection, renderIconLink } from "./PermissionsPolicySection.js";
import * as Bindings from "../../../models/bindings/bindings.js";
import * as Common from "../../../core/common/common.js";
import * as i18n from "../../../core/i18n/i18n.js";
import * as NetworkForward from "../../../panels/network/forward/forward.js";
import * as Platform from "../../../core/platform/platform.js";
import * as Root from "../../../core/root/root.js";
import * as SDK from "../../../core/sdk/sdk.js";
import * as LitHtml from "../../../ui/lit-html/lit-html.js";
import * as ExpandableList from "../../../ui/components/expandable_list/expandable_list.js";
import * as ReportView from "../../../ui/components/report_view/report_view.js";
import * as IconButton from "../../../ui/components/icon_button/icon_button.js";
import * as ComponentHelpers from "../../../ui/components/helpers/helpers.js";
import * as UI from "../../../ui/legacy/legacy.js";
import * as Workspace from "../../../models/workspace/workspace.js";
import * as Components from "../../../ui/legacy/components/utils/utils.js";
import * as Protocol from "../../../generated/protocol.js";
import { OriginTrialTreeView } from "./OriginTrialTreeView.js";
import * as Coordinator from "../../../ui/components/render_coordinator/render_coordinator.js";
import frameDetailsReportViewStyles from "./frameDetailsReportView.css.js";
const UIStrings = {
  additionalInformation: "Additional Information",
  thisAdditionalDebugging: "This additional (debugging) information is shown because the 'Protocol Monitor' experiment is enabled.",
  frameId: "Frame ID",
  document: "Document",
  url: "URL",
  clickToRevealInSourcesPanel: "Click to reveal in Sources panel",
  clickToRevealInNetworkPanel: "Click to reveal in Network panel",
  unreachableUrl: "Unreachable URL",
  clickToRevealInNetworkPanelMight: "Click to reveal in Network panel (might require page reload)",
  origin: "Origin",
  ownerElement: "Owner Element",
  clickToRevealInElementsPanel: "Click to reveal in Elements panel",
  adStatus: "Ad Status",
  rootDescription: "This frame has been identified as the root frame of an ad",
  root: "root",
  childDescription: "This frame has been identified as a child frame of an ad",
  child: "child",
  securityIsolation: "Security & Isolation",
  secureContext: "Secure Context",
  yes: "Yes",
  no: "No",
  crossoriginIsolated: "Cross-Origin Isolated",
  localhostIsAlwaysASecureContext: "`Localhost` is always a secure context",
  aFrameAncestorIsAnInsecure: "A frame ancestor is an insecure context",
  theFramesSchemeIsInsecure: "The frame's scheme is insecure",
  reportingTo: "reporting to",
  apiAvailability: "API availability",
  availabilityOfCertainApisDepends: "Availability of certain APIs depends on the document being cross-origin isolated.",
  availableTransferable: "available, transferable",
  availableNotTransferable: "available, not transferable",
  unavailable: "unavailable",
  sharedarraybufferConstructorIs: "`SharedArrayBuffer` constructor is available and `SABs` can be transferred via `postMessage`",
  sharedarraybufferConstructorIsAvailable: "`SharedArrayBuffer` constructor is available but `SABs` cannot be transferred via `postMessage`",
  willRequireCrossoriginIsolated: "\u26A0\uFE0F will require cross-origin isolated context in the future",
  requiresCrossoriginIsolated: "requires cross-origin isolated context",
  transferRequiresCrossoriginIsolatedPermission: "`SharedArrayBuffer` transfer requires enabling the permission policy:",
  available: "available",
  thePerformanceAPI: "The `performance.measureUserAgentSpecificMemory()` API is available",
  thePerformancemeasureuseragentspecificmemory: "The `performance.measureUserAgentSpecificMemory()` API is not available",
  measureMemory: "Measure Memory",
  learnMore: "Learn more",
  creationStackTrace: "Frame Creation `Stack Trace`",
  creationStackTraceExplanation: "This frame was created programmatically. The `stack trace` shows where this happened.",
  parentIsAdExplanation: "This frame is considered an ad frame because its parent frame is an ad frame.",
  matchedBlockingRuleExplanation: "This frame is considered an ad frame because its current (or previous) main document is an ad resource.",
  createdByAdScriptExplanation: "There was an ad script in the `(async) stack` when this frame was created. Examining the creation `stack trace` of this frame might provide more insight.",
  refresh: "Refresh",
  prerendering: "Prerendering",
  prerenderingStatus: "Prerendering Status",
  creatorAdScript: "Creator Ad Script"
};
const str_ = i18n.i18n.registerUIStrings("panels/application/components/FrameDetailsView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class FrameDetailsView extends UI.ThrottledWidget.ThrottledWidget {
  #reportView = new FrameDetailsReportView();
  #frame;
  constructor(frame) {
    super();
    this.#frame = frame;
    this.contentElement.classList.add("overflow-auto");
    this.contentElement.appendChild(this.#reportView);
    this.update();
    frame.resourceTreeModel().addEventListener(SDK.ResourceTreeModel.Events.PrerenderingStatusUpdated, this.update, this);
  }
  async doUpdate() {
    const debuggerId = this.#frame?.getDebuggerId();
    const debuggerModel = debuggerId ? await SDK.DebuggerModel.DebuggerModel.modelForDebuggerId(debuggerId) : null;
    const target = debuggerModel?.target();
    this.#reportView.data = { frame: this.#frame, target };
  }
}
const coordinator = Coordinator.RenderCoordinator.RenderCoordinator.instance();
export class FrameDetailsReportView extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-resources-frame-details-view`;
  #shadow = this.attachShadow({ mode: "open" });
  #frame;
  #target;
  #protocolMonitorExperimentEnabled = false;
  #permissionsPolicies = null;
  #permissionsPolicySectionData = { policies: [], showDetails: false };
  #originTrialTreeView = new OriginTrialTreeView();
  #linkifier = new Components.Linkifier.Linkifier();
  connectedCallback() {
    this.#protocolMonitorExperimentEnabled = Root.Runtime.experiments.isEnabled("protocolMonitor");
    this.#shadow.adoptedStyleSheets = [frameDetailsReportViewStyles];
  }
  set data(data) {
    this.#frame = data.frame;
    this.#target = data.target;
    if (!this.#permissionsPolicies && this.#frame) {
      this.#permissionsPolicies = this.#frame.getPermissionsPolicyState();
    }
    void this.#render();
  }
  async #render() {
    await coordinator.write("FrameDetailsView render", () => {
      if (!this.#frame) {
        return;
      }
      LitHtml.render(LitHtml.html`
        <${ReportView.ReportView.Report.litTagName} .data=${{ reportTitle: this.#frame.displayName() }}>
          ${this.#renderDocumentSection()}
          ${this.#renderIsolationSection()}
          ${this.#renderApiAvailabilitySection()}
          ${this.#renderOriginTrial()}
          ${LitHtml.Directives.until(this.#permissionsPolicies?.then((policies) => {
        this.#permissionsPolicySectionData.policies = policies || [];
        return LitHtml.html`
              <${PermissionsPolicySection.litTagName}
                .data=${this.#permissionsPolicySectionData}
              >
              </${PermissionsPolicySection.litTagName}>
            `;
      }), LitHtml.nothing)}
          ${this.#renderPrerenderingSection()}
          ${this.#protocolMonitorExperimentEnabled ? this.#renderAdditionalInfoSection() : LitHtml.nothing}
        </${ReportView.ReportView.Report.litTagName}>
      `, this.#shadow, { host: this });
    });
  }
  #renderOriginTrial() {
    if (!this.#frame) {
      return LitHtml.nothing;
    }
    this.#originTrialTreeView.classList.add("span-cols");
    const frame = this.#frame;
    const refreshOriginTrials = () => {
      void frame.getOriginTrials().then((trials) => {
        this.#originTrialTreeView.data = { trials };
      });
    };
    refreshOriginTrials();
    return LitHtml.html`
    <${ReportView.ReportView.ReportSectionHeader.litTagName}>
      ${i18n.i18n.lockedString("Origin Trials")}
      <${IconButton.IconButton.IconButton.litTagName} class="inline-button" .data=${{
      clickHandler: refreshOriginTrials,
      groups: [
        {
          iconName: "refresh_12x12_icon",
          text: i18nString(UIStrings.refresh),
          iconColor: "var(--color-text-primary)"
        }
      ]
    }}>
      </${IconButton.IconButton.IconButton.litTagName}>
    </${ReportView.ReportView.ReportSectionHeader.litTagName}>
    ${this.#originTrialTreeView}
    <${ReportView.ReportView.ReportSectionDivider.litTagName}></${ReportView.ReportView.ReportSectionDivider.litTagName}>
    `;
  }
  #renderDocumentSection() {
    if (!this.#frame) {
      return LitHtml.nothing;
    }
    return LitHtml.html`
      <${ReportView.ReportView.ReportSectionHeader.litTagName}>${i18nString(UIStrings.document)}</${ReportView.ReportView.ReportSectionHeader.litTagName}>
      <${ReportView.ReportView.ReportKey.litTagName}>${i18nString(UIStrings.url)}</${ReportView.ReportView.ReportKey.litTagName}>
      <${ReportView.ReportView.ReportValue.litTagName}>
        <div class="inline-items">
          ${this.#maybeRenderSourcesLinkForURL()}
          ${this.#maybeRenderNetworkLinkForURL()}
          <div class="text-ellipsis" title=${this.#frame.url}>${this.#frame.url}</div>
        </div>
      </${ReportView.ReportView.ReportValue.litTagName}>
      ${this.#maybeRenderUnreachableURL()}
      ${this.#maybeRenderOrigin()}
      ${LitHtml.Directives.until(this.#renderOwnerElement(), LitHtml.nothing)}
      ${this.#maybeRenderCreationStacktrace()}
      ${this.#maybeRenderAdStatus()}
      <${ReportView.ReportView.ReportSectionDivider.litTagName}></${ReportView.ReportView.ReportSectionDivider.litTagName}>
    `;
  }
  #maybeRenderSourcesLinkForURL() {
    if (!this.#frame || this.#frame.unreachableUrl()) {
      return LitHtml.nothing;
    }
    const sourceCode = this.#uiSourceCodeForFrame(this.#frame);
    return renderIconLink("sources_panel_icon", i18nString(UIStrings.clickToRevealInSourcesPanel), () => Common.Revealer.reveal(sourceCode));
  }
  #maybeRenderNetworkLinkForURL() {
    if (this.#frame) {
      const resource = this.#frame.resourceForURL(this.#frame.url);
      if (resource && resource.request) {
        const request = resource.request;
        return renderIconLink("network_panel_icon", i18nString(UIStrings.clickToRevealInNetworkPanel), () => {
          const requestLocation = NetworkForward.UIRequestLocation.UIRequestLocation.tab(request, NetworkForward.UIRequestLocation.UIRequestTabs.Headers);
          return Common.Revealer.reveal(requestLocation);
        });
      }
    }
    return LitHtml.nothing;
  }
  #uiSourceCodeForFrame(frame) {
    for (const project of Workspace.Workspace.WorkspaceImpl.instance().projects()) {
      const projectTarget = Bindings.NetworkProject.NetworkProject.getTargetForProject(project);
      if (projectTarget && projectTarget === frame.resourceTreeModel().target()) {
        const uiSourceCode = project.uiSourceCodeForURL(frame.url);
        if (uiSourceCode) {
          return uiSourceCode;
        }
      }
    }
    return null;
  }
  #maybeRenderUnreachableURL() {
    if (!this.#frame || !this.#frame.unreachableUrl()) {
      return LitHtml.nothing;
    }
    return LitHtml.html`
      <${ReportView.ReportView.ReportKey.litTagName}>${i18nString(UIStrings.unreachableUrl)}</${ReportView.ReportView.ReportKey.litTagName}>
      <${ReportView.ReportView.ReportValue.litTagName}>
        <div class="inline-items">
          ${this.#renderNetworkLinkForUnreachableURL()}
          <div class="text-ellipsis" title=${this.#frame.unreachableUrl()}>${this.#frame.unreachableUrl()}</div>
        </div>
      </${ReportView.ReportView.ReportValue.litTagName}>
    `;
  }
  #renderNetworkLinkForUnreachableURL() {
    if (this.#frame) {
      const unreachableUrl = Common.ParsedURL.ParsedURL.fromString(this.#frame.unreachableUrl());
      if (unreachableUrl) {
        return renderIconLink("network_panel_icon", i18nString(UIStrings.clickToRevealInNetworkPanelMight), () => {
          void Common.Revealer.reveal(NetworkForward.UIFilter.UIRequestFilter.filters([
            {
              filterType: NetworkForward.UIFilter.FilterType.Domain,
              filterValue: unreachableUrl.domain()
            },
            {
              filterType: null,
              filterValue: unreachableUrl.path
            }
          ]));
        });
      }
    }
    return LitHtml.nothing;
  }
  #maybeRenderOrigin() {
    if (this.#frame && this.#frame.securityOrigin && this.#frame.securityOrigin !== "://") {
      return LitHtml.html`
        <${ReportView.ReportView.ReportKey.litTagName}>${i18nString(UIStrings.origin)}</${ReportView.ReportView.ReportKey.litTagName}>
        <${ReportView.ReportView.ReportValue.litTagName}>
          <div class="text-ellipsis" title=${this.#frame.securityOrigin}>${this.#frame.securityOrigin}</div>
        </${ReportView.ReportView.ReportValue.litTagName}>
      `;
    }
    return LitHtml.nothing;
  }
  async #renderOwnerElement() {
    if (this.#frame) {
      const linkTargetDOMNode = await this.#frame.getOwnerDOMNodeOrDocument();
      if (linkTargetDOMNode) {
        return LitHtml.html`
            <${ReportView.ReportView.ReportKey.litTagName}>${i18nString(UIStrings.ownerElement)}</${ReportView.ReportView.ReportKey.litTagName}>
          <${ReportView.ReportView.ReportValue.litTagName} class="without-min-width">
              <button class="link" role="link" tabindex=0 title=${i18nString(UIStrings.clickToRevealInElementsPanel)}
              @mouseenter=${() => this.#frame?.highlight()}
              @mouseleave=${() => SDK.OverlayModel.OverlayModel.hideDOMNodeHighlight()}
              @click=${() => Common.Revealer.reveal(linkTargetDOMNode)}
            >
              <${IconButton.Icon.Icon.litTagName} class="button-icon-with-text" .data=${{
          iconName: "elements_panel_icon",
          color: "var(--color-primary)",
          width: "16px",
          height: "16px"
        }}></${IconButton.Icon.Icon.litTagName}>
              &lt;${linkTargetDOMNode.nodeName().toLocaleLowerCase()}&gt;
            </button>
          </${ReportView.ReportView.ReportValue.litTagName}>
        `;
      }
    }
    return LitHtml.nothing;
  }
  #maybeRenderCreationStacktrace() {
    const creationStackTraceData = this.#frame?.getCreationStackTraceData();
    if (creationStackTraceData && creationStackTraceData.creationStackTrace) {
      return LitHtml.html`
        <${ReportView.ReportView.ReportKey.litTagName} title=${i18nString(UIStrings.creationStackTraceExplanation)}>${i18nString(UIStrings.creationStackTrace)}</${ReportView.ReportView.ReportKey.litTagName}>
        <${ReportView.ReportView.ReportValue.litTagName}>
          <${StackTrace.litTagName} .data=${{
        frame: this.#frame,
        buildStackTraceRows: Components.JSPresentationUtils.buildStackTraceRows
      }}>
          </${StackTrace.litTagName}>
        </${ReportView.ReportView.ReportValue.litTagName}>
      `;
    }
    return LitHtml.nothing;
  }
  #getAdFrameTypeStrings(type) {
    switch (type) {
      case Protocol.Page.AdFrameType.Child:
        return { value: i18nString(UIStrings.child), description: i18nString(UIStrings.childDescription) };
      case Protocol.Page.AdFrameType.Root:
        return { value: i18nString(UIStrings.root), description: i18nString(UIStrings.rootDescription) };
    }
  }
  #getAdFrameExplanationString(explanation) {
    switch (explanation) {
      case Protocol.Page.AdFrameExplanation.CreatedByAdScript:
        return i18nString(UIStrings.createdByAdScriptExplanation);
      case Protocol.Page.AdFrameExplanation.MatchedBlockingRule:
        return i18nString(UIStrings.matchedBlockingRuleExplanation);
      case Protocol.Page.AdFrameExplanation.ParentIsAd:
        return i18nString(UIStrings.parentIsAdExplanation);
    }
  }
  #maybeRenderAdStatus() {
    if (!this.#frame) {
      return LitHtml.nothing;
    }
    const adFrameType = this.#frame.adFrameType();
    if (adFrameType === Protocol.Page.AdFrameType.None) {
      return LitHtml.nothing;
    }
    const typeStrings = this.#getAdFrameTypeStrings(adFrameType);
    const rows = [LitHtml.html`<div title=${typeStrings.description}>${typeStrings.value}</div>`];
    for (const explanation of this.#frame.adFrameStatus()?.explanations || []) {
      rows.push(LitHtml.html`<div>${this.#getAdFrameExplanationString(explanation)}</div>`);
    }
    const adScriptLinkElement = this.#target ? this.#linkifier.linkifyScriptLocation(this.#target, this.#frame.getAdScriptId(), Platform.DevToolsPath.EmptyUrlString, void 0, void 0) : null;
    return LitHtml.html`
      <${ReportView.ReportView.ReportKey.litTagName}>${i18nString(UIStrings.adStatus)}</${ReportView.ReportView.ReportKey.litTagName}>
      <${ReportView.ReportView.ReportValue.litTagName}>
        <${ExpandableList.ExpandableList.ExpandableList.litTagName} .data=${{ rows }}></${ExpandableList.ExpandableList.ExpandableList.litTagName}></${ReportView.ReportView.ReportValue.litTagName}>
      ${this.#target ? LitHtml.html`
        <${ReportView.ReportView.ReportKey.litTagName}>${i18nString(UIStrings.creatorAdScript)}</${ReportView.ReportView.ReportKey.litTagName}>
        <${ReportView.ReportView.ReportValue.litTagName} class="ad-script-link">${adScriptLinkElement}</${ReportView.ReportView.ReportValue.litTagName}>
      ` : LitHtml.nothing}
    `;
  }
  #renderIsolationSection() {
    if (!this.#frame) {
      return LitHtml.nothing;
    }
    return LitHtml.html`
      <${ReportView.ReportView.ReportSectionHeader.litTagName}>${i18nString(UIStrings.securityIsolation)}</${ReportView.ReportView.ReportSectionHeader.litTagName}>
      <${ReportView.ReportView.ReportKey.litTagName}>${i18nString(UIStrings.secureContext)}</${ReportView.ReportView.ReportKey.litTagName}>
      <${ReportView.ReportView.ReportValue.litTagName}>
        ${this.#frame.isSecureContext() ? i18nString(UIStrings.yes) : i18nString(UIStrings.no)}\xA0${this.#maybeRenderSecureContextExplanation()}
      </${ReportView.ReportView.ReportValue.litTagName}>
      <${ReportView.ReportView.ReportKey.litTagName}>${i18nString(UIStrings.crossoriginIsolated)}</${ReportView.ReportView.ReportKey.litTagName}>
      <${ReportView.ReportView.ReportValue.litTagName}>
        ${this.#frame.isCrossOriginIsolated() ? i18nString(UIStrings.yes) : i18nString(UIStrings.no)}
      </${ReportView.ReportView.ReportValue.litTagName}>
      ${LitHtml.Directives.until(this.#maybeRenderCoopCoepStatus(), LitHtml.nothing)}
      <${ReportView.ReportView.ReportSectionDivider.litTagName}></${ReportView.ReportView.ReportSectionDivider.litTagName}>
    `;
  }
  #maybeRenderSecureContextExplanation() {
    const explanation = this.#getSecureContextExplanation();
    if (explanation) {
      return LitHtml.html`<span class="inline-comment">${explanation}</span>`;
    }
    return LitHtml.nothing;
  }
  #getSecureContextExplanation() {
    switch (this.#frame?.getSecureContextType()) {
      case Protocol.Page.SecureContextType.Secure:
        return null;
      case Protocol.Page.SecureContextType.SecureLocalhost:
        return i18nString(UIStrings.localhostIsAlwaysASecureContext);
      case Protocol.Page.SecureContextType.InsecureAncestor:
        return i18nString(UIStrings.aFrameAncestorIsAnInsecure);
      case Protocol.Page.SecureContextType.InsecureScheme:
        return i18nString(UIStrings.theFramesSchemeIsInsecure);
    }
    return null;
  }
  async #maybeRenderCoopCoepStatus() {
    if (this.#frame) {
      const model = this.#frame.resourceTreeModel().target().model(SDK.NetworkManager.NetworkManager);
      const info = model && await model.getSecurityIsolationStatus(this.#frame.id);
      if (info) {
        return LitHtml.html`
          ${this.#maybeRenderCrossOriginStatus(info.coep, i18n.i18n.lockedString("Cross-Origin Embedder Policy (COEP)"), Protocol.Network.CrossOriginEmbedderPolicyValue.None)}
          ${this.#maybeRenderCrossOriginStatus(info.coop, i18n.i18n.lockedString("Cross-Origin Opener Policy (COOP)"), Protocol.Network.CrossOriginOpenerPolicyValue.UnsafeNone)}
        `;
      }
    }
    return LitHtml.nothing;
  }
  #maybeRenderCrossOriginStatus(info, policyName, noneValue) {
    if (!info) {
      return LitHtml.nothing;
    }
    const isEnabled = info.value !== noneValue;
    const isReportOnly = !isEnabled && info.reportOnlyValue !== noneValue;
    const endpoint = isEnabled ? info.reportingEndpoint : info.reportOnlyReportingEndpoint;
    return LitHtml.html`
      <${ReportView.ReportView.ReportKey.litTagName}>${policyName}</${ReportView.ReportView.ReportKey.litTagName}>
      <${ReportView.ReportView.ReportValue.litTagName}>
        ${isEnabled ? info.value : info.reportOnlyValue}
        ${isReportOnly ? LitHtml.html`<span class="inline-comment">report-only</span>` : LitHtml.nothing}
        ${endpoint ? LitHtml.html`<span class="inline-name">${i18nString(UIStrings.reportingTo)}</span>${endpoint}` : LitHtml.nothing}
      </${ReportView.ReportView.ReportValue.litTagName}>
    `;
  }
  #renderApiAvailabilitySection() {
    if (!this.#frame) {
      return LitHtml.nothing;
    }
    return LitHtml.html`
      <${ReportView.ReportView.ReportSectionHeader.litTagName}>${i18nString(UIStrings.apiAvailability)}</${ReportView.ReportView.ReportSectionHeader.litTagName}>
      <div class="span-cols">
        ${i18nString(UIStrings.availabilityOfCertainApisDepends)}
        <x-link href="https://web.dev/why-coop-coep/" class="link">${i18nString(UIStrings.learnMore)}</x-link>
      </div>
      ${this.#renderSharedArrayBufferAvailability()}
      ${this.#renderMeasureMemoryAvailability()}
      <${ReportView.ReportView.ReportSectionDivider.litTagName}></${ReportView.ReportView.ReportSectionDivider.litTagName}>
    `;
  }
  #renderSharedArrayBufferAvailability() {
    if (this.#frame) {
      const features = this.#frame.getGatedAPIFeatures();
      if (features) {
        let renderHint = function(frame) {
          switch (frame.getCrossOriginIsolatedContextType()) {
            case Protocol.Page.CrossOriginIsolatedContextType.Isolated:
              return LitHtml.nothing;
            case Protocol.Page.CrossOriginIsolatedContextType.NotIsolated:
              if (sabAvailable) {
                return LitHtml.html`<span class="inline-comment">${i18nString(UIStrings.willRequireCrossoriginIsolated)}</span>`;
              }
              return LitHtml.html`<span class="inline-comment">${i18nString(UIStrings.requiresCrossoriginIsolated)}</span>`;
            case Protocol.Page.CrossOriginIsolatedContextType.NotIsolatedFeatureDisabled:
              if (!sabTransferAvailable) {
                return LitHtml.html`<span class="inline-comment">${i18nString(UIStrings.transferRequiresCrossoriginIsolatedPermission)} <code>cross-origin-isolated</code></span>`;
              }
              break;
          }
          return LitHtml.nothing;
        };
        const sabAvailable = features.includes(Protocol.Page.GatedAPIFeatures.SharedArrayBuffers);
        const sabTransferAvailable = sabAvailable && features.includes(Protocol.Page.GatedAPIFeatures.SharedArrayBuffersTransferAllowed);
        const availabilityText = sabTransferAvailable ? i18nString(UIStrings.availableTransferable) : sabAvailable ? i18nString(UIStrings.availableNotTransferable) : i18nString(UIStrings.unavailable);
        const tooltipText = sabTransferAvailable ? i18nString(UIStrings.sharedarraybufferConstructorIs) : sabAvailable ? i18nString(UIStrings.sharedarraybufferConstructorIsAvailable) : "";
        return LitHtml.html`
          <${ReportView.ReportView.ReportKey.litTagName}>SharedArrayBuffers</${ReportView.ReportView.ReportKey.litTagName}>
          <${ReportView.ReportView.ReportValue.litTagName} title=${tooltipText}>
            ${availabilityText}\xA0${renderHint(this.#frame)}
          </${ReportView.ReportView.ReportValue.litTagName}>
        `;
      }
    }
    return LitHtml.nothing;
  }
  #renderMeasureMemoryAvailability() {
    if (this.#frame) {
      const measureMemoryAvailable = this.#frame.isCrossOriginIsolated();
      const availabilityText = measureMemoryAvailable ? i18nString(UIStrings.available) : i18nString(UIStrings.unavailable);
      const tooltipText = measureMemoryAvailable ? i18nString(UIStrings.thePerformanceAPI) : i18nString(UIStrings.thePerformancemeasureuseragentspecificmemory);
      return LitHtml.html`
        <${ReportView.ReportView.ReportKey.litTagName}>${i18nString(UIStrings.measureMemory)}</${ReportView.ReportView.ReportKey.litTagName}>
        <${ReportView.ReportView.ReportValue.litTagName}>
          <span title=${tooltipText}>${availabilityText}</span>\xA0<x-link class="link" href="https://web.dev/monitor-total-page-memory-usage/">${i18nString(UIStrings.learnMore)}</x-link>
        </${ReportView.ReportView.ReportValue.litTagName}>
      `;
    }
    return LitHtml.nothing;
  }
  #renderPrerenderingSection() {
    if (!this.#frame || !this.#frame.prerenderFinalStatus) {
      return LitHtml.nothing;
    }
    return LitHtml.html`
      <${ReportView.ReportView.ReportSectionHeader.litTagName}>
      ${i18nString(UIStrings.prerendering)}</${ReportView.ReportView.ReportSectionHeader.litTagName}>
      <${ReportView.ReportView.ReportKey.litTagName}>${i18nString(UIStrings.prerenderingStatus)}</${ReportView.ReportView.ReportKey.litTagName}>
      <${ReportView.ReportView.ReportValue.litTagName}>
        <div class="text-ellipsis" title=${this.#frame.prerenderFinalStatus}>${this.#frame.prerenderFinalStatus}</div>
      </${ReportView.ReportView.ReportValue.litTagName}>
      <${ReportView.ReportView.ReportSectionDivider.litTagName}></${ReportView.ReportView.ReportSectionDivider.litTagName}>`;
  }
  #renderAdditionalInfoSection() {
    if (!this.#frame) {
      return LitHtml.nothing;
    }
    return LitHtml.html`
      <${ReportView.ReportView.ReportSectionHeader.litTagName}
        title=${i18nString(UIStrings.thisAdditionalDebugging)}
      >${i18nString(UIStrings.additionalInformation)}</${ReportView.ReportView.ReportSectionHeader.litTagName}>
      <${ReportView.ReportView.ReportKey.litTagName}>${i18nString(UIStrings.frameId)}</${ReportView.ReportView.ReportKey.litTagName}>
      <${ReportView.ReportView.ReportValue.litTagName}>
        <div class="text-ellipsis" title=${this.#frame.id}>${this.#frame.id}</div>
      </${ReportView.ReportView.ReportValue.litTagName}>
      <${ReportView.ReportView.ReportSectionDivider.litTagName}></${ReportView.ReportView.ReportSectionDivider.litTagName}>
    `;
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-resources-frame-details-view", FrameDetailsReportView);
//# sourceMappingURL=FrameDetailsView.js.map
