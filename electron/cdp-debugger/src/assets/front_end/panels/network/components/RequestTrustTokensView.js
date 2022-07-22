import * as i18n from "../../../core/i18n/i18n.js";
import * as SDK from "../../../core/sdk/sdk.js";
import * as Protocol from "../../../generated/protocol.js";
import * as ComponentHelpers from "../../../ui/components/helpers/helpers.js";
import * as IconButton from "../../../ui/components/icon_button/icon_button.js";
import * as ReportView from "../../../ui/components/report_view/report_view.js";
import * as UI from "../../../ui/legacy/legacy.js";
import * as LitHtml from "../../../ui/lit-html/lit-html.js";
import requestTrustTokensViewStyles from "./RequestTrustTokensView.css.js";
const UIStrings = {
  parameters: "Parameters",
  type: "Type",
  refreshPolicy: "Refresh policy",
  issuers: "Issuers",
  topLevelOrigin: "Top level origin",
  issuer: "Issuer",
  result: "Result",
  status: "Status",
  numberOfIssuedTokens: "Number of issued tokens",
  success: "Success",
  failure: "Failure",
  theOperationsResultWasServedFrom: "The operations result was served from cache.",
  theOperationWasFulfilledLocally: "The operation was fulfilled locally, no request was sent.",
  aClientprovidedArgumentWas: "A client-provided argument was malformed or otherwise invalid.",
  eitherNoInputsForThisOperation: "Either no inputs for this operation are available or the output exceeds the operations quota.",
  theServersResponseWasMalformedOr: "The servers response was malformed or otherwise invalid.",
  theOperationFailedForAnUnknown: "The operation failed for an unknown reason."
};
const str_ = i18n.i18n.registerUIStrings("panels/network/components/RequestTrustTokensView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class RequestTrustTokensView extends UI.Widget.VBox {
  #reportView = new RequestTrustTokensReport();
  #request;
  constructor(request) {
    super();
    this.#request = request;
    this.contentElement.appendChild(this.#reportView);
  }
  wasShown() {
    this.#request.addEventListener(SDK.NetworkRequest.Events.TrustTokenResultAdded, this.#refreshReportView, this);
    this.#refreshReportView();
  }
  willHide() {
    this.#request.removeEventListener(SDK.NetworkRequest.Events.TrustTokenResultAdded, this.#refreshReportView, this);
  }
  #refreshReportView() {
    this.#reportView.data = {
      params: this.#request.trustTokenParams(),
      result: this.#request.trustTokenOperationDoneEvent()
    };
  }
}
export class RequestTrustTokensReport extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-trust-token-report`;
  #shadow = this.attachShadow({ mode: "open" });
  #trustTokenData;
  set data(data) {
    this.#trustTokenData = data;
    this.#render();
  }
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [requestTrustTokensViewStyles];
  }
  #render() {
    if (!this.#trustTokenData) {
      throw new Error("Trying to render a Trust Token report without providing data");
    }
    LitHtml.render(LitHtml.html`<${ReportView.ReportView.Report.litTagName}>
        ${this.#renderParameterSection()}
        ${this.#renderResultSection()}
      </${ReportView.ReportView.Report.litTagName}>
    `, this.#shadow, { host: this });
  }
  #renderParameterSection() {
    if (!this.#trustTokenData || !this.#trustTokenData.params) {
      return LitHtml.nothing;
    }
    return LitHtml.html`
      <${ReportView.ReportView.ReportSectionHeader.litTagName}>${i18nString(UIStrings.parameters)}</${ReportView.ReportView.ReportSectionHeader.litTagName}>
      ${renderRowWithCodeValue(i18nString(UIStrings.type), this.#trustTokenData.params.type.toString())}
      ${this.#renderRefreshPolicy(this.#trustTokenData.params)}
      ${this.#renderIssuers(this.#trustTokenData.params)}
      ${this.#renderIssuerAndTopLevelOriginFromResult()}
      <${ReportView.ReportView.ReportSectionDivider.litTagName}></${ReportView.ReportView.ReportSectionDivider.litTagName}>
    `;
  }
  #renderRefreshPolicy(params) {
    if (params.type !== Protocol.Network.TrustTokenOperationType.Redemption) {
      return LitHtml.nothing;
    }
    return renderRowWithCodeValue(i18nString(UIStrings.refreshPolicy), params.refreshPolicy.toString());
  }
  #renderIssuers(params) {
    if (!params.issuers || params.issuers.length === 0) {
      return LitHtml.nothing;
    }
    return LitHtml.html`
      <${ReportView.ReportView.ReportKey.litTagName}>${i18nString(UIStrings.issuers)}</${ReportView.ReportView.ReportKey.litTagName}>
      <${ReportView.ReportView.ReportValue.litTagName}>
        <ul class="issuers-list">
          ${params.issuers.map((issuer) => LitHtml.html`<li>${issuer}</li>`)}
        </ul>
      </${ReportView.ReportView.ReportValue.litTagName}>
    `;
  }
  #renderIssuerAndTopLevelOriginFromResult() {
    if (!this.#trustTokenData || !this.#trustTokenData.result) {
      return LitHtml.nothing;
    }
    return LitHtml.html`
      ${renderSimpleRowIfValuePresent(i18nString(UIStrings.topLevelOrigin), this.#trustTokenData.result.topLevelOrigin)}
      ${renderSimpleRowIfValuePresent(i18nString(UIStrings.issuer), this.#trustTokenData.result.issuerOrigin)}`;
  }
  #renderResultSection() {
    if (!this.#trustTokenData || !this.#trustTokenData.result) {
      return LitHtml.nothing;
    }
    return LitHtml.html`
      <${ReportView.ReportView.ReportSectionHeader.litTagName}>${i18nString(UIStrings.result)}</${ReportView.ReportView.ReportSectionHeader.litTagName}>
      <${ReportView.ReportView.ReportKey.litTagName}>${i18nString(UIStrings.status)}</${ReportView.ReportView.ReportKey.litTagName}>
      <${ReportView.ReportView.ReportValue.litTagName}>
        <span>
          <${IconButton.Icon.Icon.litTagName} class="status-icon"
            .data=${getIconForStatusCode(this.#trustTokenData.result.status)}>
          </${IconButton.Icon.Icon.litTagName}>
          <strong>${getSimplifiedStatusTextForStatusCode(this.#trustTokenData.result.status)}</strong>
          ${getDetailedTextForStatusCode(this.#trustTokenData.result.status)}
        </span>
      </${ReportView.ReportView.ReportValue.litTagName}>
      ${this.#renderIssuedTokenCount(this.#trustTokenData.result)}
      <${ReportView.ReportView.ReportSectionDivider.litTagName}></${ReportView.ReportView.ReportSectionDivider.litTagName}>
      `;
  }
  #renderIssuedTokenCount(result) {
    if (result.type !== Protocol.Network.TrustTokenOperationType.Issuance) {
      return LitHtml.nothing;
    }
    return renderSimpleRowIfValuePresent(i18nString(UIStrings.numberOfIssuedTokens), result.issuedTokenCount);
  }
}
const SUCCESS_ICON_DATA = {
  color: "rgb(12, 164, 12)",
  iconName: "ic_checkmark_16x16",
  width: "12px"
};
const FAILURE_ICON_DATA = {
  color: "",
  iconName: "error_icon",
  width: "12px"
};
export function statusConsideredSuccess(status) {
  return status === Protocol.Network.TrustTokenOperationDoneEventStatus.Ok || status === Protocol.Network.TrustTokenOperationDoneEventStatus.AlreadyExists || status === Protocol.Network.TrustTokenOperationDoneEventStatus.FulfilledLocally;
}
function getIconForStatusCode(status) {
  return statusConsideredSuccess(status) ? SUCCESS_ICON_DATA : FAILURE_ICON_DATA;
}
function getSimplifiedStatusTextForStatusCode(status) {
  return statusConsideredSuccess(status) ? i18nString(UIStrings.success) : i18nString(UIStrings.failure);
}
function getDetailedTextForStatusCode(status) {
  switch (status) {
    case Protocol.Network.TrustTokenOperationDoneEventStatus.Ok:
      return null;
    case Protocol.Network.TrustTokenOperationDoneEventStatus.AlreadyExists:
      return i18nString(UIStrings.theOperationsResultWasServedFrom);
    case Protocol.Network.TrustTokenOperationDoneEventStatus.FulfilledLocally:
      return i18nString(UIStrings.theOperationWasFulfilledLocally);
    case Protocol.Network.TrustTokenOperationDoneEventStatus.InvalidArgument:
      return i18nString(UIStrings.aClientprovidedArgumentWas);
    case Protocol.Network.TrustTokenOperationDoneEventStatus.ResourceExhausted:
      return i18nString(UIStrings.eitherNoInputsForThisOperation);
    case Protocol.Network.TrustTokenOperationDoneEventStatus.BadResponse:
      return i18nString(UIStrings.theServersResponseWasMalformedOr);
    case Protocol.Network.TrustTokenOperationDoneEventStatus.FailedPrecondition:
    case Protocol.Network.TrustTokenOperationDoneEventStatus.Unavailable:
    case Protocol.Network.TrustTokenOperationDoneEventStatus.InternalError:
    case Protocol.Network.TrustTokenOperationDoneEventStatus.UnknownError:
      return i18nString(UIStrings.theOperationFailedForAnUnknown);
  }
}
function renderSimpleRowIfValuePresent(key, value) {
  if (value === void 0) {
    return LitHtml.nothing;
  }
  return LitHtml.html`
    <${ReportView.ReportView.ReportKey.litTagName}>${key}</${ReportView.ReportView.ReportKey.litTagName}>
    <${ReportView.ReportView.ReportValue.litTagName}>${value}</${ReportView.ReportView.ReportValue.litTagName}>
  `;
}
function renderRowWithCodeValue(key, value) {
  return LitHtml.html`
    <${ReportView.ReportView.ReportKey.litTagName}>${key}</${ReportView.ReportView.ReportKey.litTagName}>
    <${ReportView.ReportView.ReportValue.litTagName} class="code">${value}</${ReportView.ReportView.ReportValue.litTagName}>
  `;
}
ComponentHelpers.CustomElements.defineComponent("devtools-trust-token-report", RequestTrustTokensReport);
//# sourceMappingURL=RequestTrustTokensView.js.map
