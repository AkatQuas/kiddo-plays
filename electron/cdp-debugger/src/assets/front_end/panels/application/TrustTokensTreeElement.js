import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as UI from "../../ui/legacy/legacy.js";
import { ApplicationPanelTreeElement } from "./ApplicationPanelTreeElement.js";
import * as ApplicationComponents from "./components/components.js";
import * as Host from "../../core/host/host.js";
const UIStrings = {
  trustTokens: "Trust Tokens"
};
const str_ = i18n.i18n.registerUIStrings("panels/application/TrustTokensTreeElement.ts", UIStrings);
export const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const REFRESH_INTERVAL_MS = 1e3;
export class TrustTokensTreeElement extends ApplicationPanelTreeElement {
  view;
  constructor(storagePanel) {
    super(storagePanel, i18nString(UIStrings.trustTokens), false);
    const icon = UI.Icon.Icon.create("mediumicon-database", "resource-tree-item");
    this.setLeadingIcons([icon]);
  }
  get itemURL() {
    return "trustTokens://";
  }
  onselect(selectedByUser) {
    super.onselect(selectedByUser);
    if (!this.view) {
      this.view = new TrustTokensViewWidgetWrapper();
    }
    this.showView(this.view);
    Host.userMetrics.panelShown(Host.UserMetrics.PanelCodes[Host.UserMetrics.PanelCodes.trust_tokens]);
    return false;
  }
}
export class TrustTokensViewWidgetWrapper extends UI.ThrottledWidget.ThrottledWidget {
  trustTokensView = new ApplicationComponents.TrustTokensView.TrustTokensView();
  constructor() {
    super(false, REFRESH_INTERVAL_MS);
    this.contentElement.appendChild(this.trustTokensView);
    this.update();
  }
  async doUpdate() {
    const mainTarget = SDK.TargetManager.TargetManager.instance().mainTarget();
    if (!mainTarget) {
      return;
    }
    const { tokens } = await mainTarget.storageAgent().invoke_getTrustTokens();
    this.trustTokensView.data = {
      tokens,
      deleteClickHandler: (issuer) => {
        void mainTarget.storageAgent().invoke_clearTrustTokens({ issuerOrigin: issuer });
      }
    };
    this.update();
  }
}
//# sourceMappingURL=TrustTokensTreeElement.js.map
