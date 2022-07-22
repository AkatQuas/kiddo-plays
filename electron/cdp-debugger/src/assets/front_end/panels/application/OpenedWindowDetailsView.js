import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
import * as UI from "../../ui/legacy/legacy.js";
import frameDetailsReportViewStyles from "./frameDetailsReportView.css.js";
const UIStrings = {
  yes: "Yes",
  no: "No",
  clickToRevealInElementsPanel: "Click to reveal in Elements panel",
  document: "Document",
  url: "URL",
  security: "Security",
  openerFrame: "Opener Frame",
  accessToOpener: "Access to opener",
  showsWhetherTheOpenedWindowIs: "Shows whether the opened window is able to access its opener and vice versa",
  windowWithoutTitle: "Window without title",
  closed: "closed",
  worker: "worker",
  type: "Type",
  securityIsolation: "Security & Isolation",
  crossoriginEmbedderPolicy: "Cross-Origin Embedder Policy",
  webWorker: "Web Worker",
  unknown: "Unknown",
  reportingTo: "reporting to"
};
const str_ = i18n.i18n.registerUIStrings("panels/application/OpenedWindowDetailsView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const booleanToYesNo = (b) => b ? i18nString(UIStrings.yes) : i18nString(UIStrings.no);
function linkifyIcon(iconType, title, eventHandler) {
  const icon = UI.Icon.Icon.create(iconType, "icon-link devtools-link");
  const span = document.createElement("span");
  UI.Tooltip.Tooltip.install(span, title);
  span.classList.add("devtools-link");
  span.tabIndex = 0;
  span.appendChild(icon);
  span.addEventListener("click", (event) => {
    event.consume(true);
    void eventHandler();
  });
  span.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.consume(true);
      void eventHandler();
    }
  });
  return span;
}
async function maybeCreateLinkToElementsPanel(opener) {
  let openerFrame = null;
  if (opener instanceof SDK.ResourceTreeModel.ResourceTreeFrame) {
    openerFrame = opener;
  } else if (opener) {
    openerFrame = SDK.FrameManager.FrameManager.instance().getFrame(opener);
  }
  if (!openerFrame) {
    return null;
  }
  const linkTargetDOMNode = await openerFrame.getOwnerDOMNodeOrDocument();
  if (!linkTargetDOMNode) {
    return null;
  }
  const linkElement = linkifyIcon("mediumicon-elements-panel", i18nString(UIStrings.clickToRevealInElementsPanel), () => Common.Revealer.reveal(linkTargetDOMNode));
  const label = document.createElement("span");
  label.textContent = `<${linkTargetDOMNode.nodeName().toLocaleLowerCase()}>`;
  linkElement.insertBefore(label, linkElement.firstChild);
  linkElement.addEventListener("mouseenter", () => {
    if (openerFrame) {
      void openerFrame.highlight();
    }
  });
  linkElement.addEventListener("mouseleave", () => {
    SDK.OverlayModel.OverlayModel.hideDOMNodeHighlight();
  });
  return linkElement;
}
export class OpenedWindowDetailsView extends UI.ThrottledWidget.ThrottledWidget {
  targetInfo;
  isWindowClosed;
  reportView;
  documentSection;
  URLFieldValue;
  securitySection;
  openerElementField;
  hasDOMAccessValue;
  constructor(targetInfo, isWindowClosed) {
    super();
    this.targetInfo = targetInfo;
    this.isWindowClosed = isWindowClosed;
    this.contentElement.classList.add("frame-details-container");
    this.reportView = new UI.ReportView.ReportView(this.buildTitle());
    this.reportView.show(this.contentElement);
    this.reportView.element.classList.add("frame-details-report-container");
    this.documentSection = this.reportView.appendSection(i18nString(UIStrings.document));
    this.URLFieldValue = this.documentSection.appendField(i18nString(UIStrings.url));
    this.securitySection = this.reportView.appendSection(i18nString(UIStrings.security));
    this.openerElementField = this.securitySection.appendField(i18nString(UIStrings.openerFrame));
    this.securitySection.setFieldVisible(i18nString(UIStrings.openerFrame), false);
    this.hasDOMAccessValue = this.securitySection.appendField(i18nString(UIStrings.accessToOpener));
    UI.Tooltip.Tooltip.install(this.hasDOMAccessValue, i18nString(UIStrings.showsWhetherTheOpenedWindowIs));
    this.update();
  }
  async doUpdate() {
    this.reportView.setTitle(this.buildTitle());
    this.URLFieldValue.textContent = this.targetInfo.url;
    this.hasDOMAccessValue.textContent = booleanToYesNo(this.targetInfo.canAccessOpener);
    void this.maybeDisplayOpenerFrame();
  }
  async maybeDisplayOpenerFrame() {
    this.openerElementField.removeChildren();
    const linkElement = await maybeCreateLinkToElementsPanel(this.targetInfo.openerFrameId);
    if (linkElement) {
      this.openerElementField.append(linkElement);
      this.securitySection.setFieldVisible(i18nString(UIStrings.openerFrame), true);
      return;
    }
    this.securitySection.setFieldVisible(i18nString(UIStrings.openerFrame), false);
  }
  buildTitle() {
    let title = this.targetInfo.title || i18nString(UIStrings.windowWithoutTitle);
    if (this.isWindowClosed) {
      title += ` (${i18nString(UIStrings.closed)})`;
    }
    return title;
  }
  setIsWindowClosed(isWindowClosed) {
    this.isWindowClosed = isWindowClosed;
  }
  setTargetInfo(targetInfo) {
    this.targetInfo = targetInfo;
  }
  wasShown() {
    super.wasShown();
    this.reportView.registerCSSFiles([frameDetailsReportViewStyles]);
    this.registerCSSFiles([frameDetailsReportViewStyles]);
  }
}
export class WorkerDetailsView extends UI.ThrottledWidget.ThrottledWidget {
  targetInfo;
  reportView;
  documentSection;
  URLFieldValue;
  isolationSection;
  coepPolicy;
  constructor(targetInfo) {
    super();
    this.targetInfo = targetInfo;
    this.contentElement.classList.add("frame-details-container");
    this.reportView = new UI.ReportView.ReportView(this.targetInfo.title || this.targetInfo.url || i18nString(UIStrings.worker));
    this.reportView.show(this.contentElement);
    this.reportView.element.classList.add("frame-details-report-container");
    this.documentSection = this.reportView.appendSection(i18nString(UIStrings.document));
    this.URLFieldValue = this.documentSection.appendField(i18nString(UIStrings.url));
    this.URLFieldValue.textContent = this.targetInfo.url;
    const workerType = this.documentSection.appendField(i18nString(UIStrings.type));
    workerType.textContent = this.workerTypeToString(this.targetInfo.type);
    this.isolationSection = this.reportView.appendSection(i18nString(UIStrings.securityIsolation));
    this.coepPolicy = this.isolationSection.appendField(i18nString(UIStrings.crossoriginEmbedderPolicy));
    this.update();
  }
  workerTypeToString(type) {
    if (type === "worker") {
      return i18nString(UIStrings.webWorker);
    }
    if (type === "service_worker") {
      return i18n.i18n.lockedString("Service Worker");
    }
    return i18nString(UIStrings.unknown);
  }
  async updateCoopCoepStatus() {
    const target = SDK.TargetManager.TargetManager.instance().targetById(this.targetInfo.targetId);
    if (!target) {
      return;
    }
    const model = target.model(SDK.NetworkManager.NetworkManager);
    const info = model && await model.getSecurityIsolationStatus(null);
    if (!info) {
      return;
    }
    const coepIsEnabled = (value) => value !== Protocol.Network.CrossOriginEmbedderPolicyValue.None;
    this.fillCrossOriginPolicy(this.coepPolicy, coepIsEnabled, info.coep);
  }
  fillCrossOriginPolicy(field, isEnabled, info) {
    if (!info) {
      field.textContent = "";
      return;
    }
    const enabled = isEnabled(info.value);
    field.textContent = enabled ? info.value : info.reportOnlyValue;
    if (!enabled && isEnabled(info.reportOnlyValue)) {
      const reportOnly = document.createElement("span");
      reportOnly.classList.add("inline-comment");
      reportOnly.textContent = "report-only";
      field.appendChild(reportOnly);
    }
    const endpoint = enabled ? info.reportingEndpoint : info.reportOnlyReportingEndpoint;
    if (endpoint) {
      const reportingEndpointPrefix = field.createChild("span", "inline-name");
      reportingEndpointPrefix.textContent = i18nString(UIStrings.reportingTo);
      const reportingEndpointName = field.createChild("span");
      reportingEndpointName.textContent = endpoint;
    }
  }
  async doUpdate() {
    await this.updateCoopCoepStatus();
  }
  wasShown() {
    super.wasShown();
    this.reportView.registerCSSFiles([frameDetailsReportViewStyles]);
    this.registerCSSFiles([frameDetailsReportViewStyles]);
  }
}
//# sourceMappingURL=OpenedWindowDetailsView.js.map
