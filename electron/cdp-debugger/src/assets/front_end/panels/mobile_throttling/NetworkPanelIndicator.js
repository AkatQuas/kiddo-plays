import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  networkThrottlingIsEnabled: "Network throttling is enabled",
  requestsMayBeRewrittenByLocal: "Requests may be rewritten by local overrides",
  requestsMayBeBlocked: "Requests may be blocked",
  acceptedEncodingOverrideSet: "The set of accepted `Content-Encoding` headers has been modified by DevTools. See the Network Conditions panel."
};
const str_ = i18n.i18n.registerUIStrings("panels/mobile_throttling/NetworkPanelIndicator.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class NetworkPanelIndicator {
  constructor() {
    if (!UI.InspectorView.InspectorView.instance().hasPanel("network")) {
      return;
    }
    const manager = SDK.NetworkManager.MultitargetNetworkManager.instance();
    manager.addEventListener(SDK.NetworkManager.MultitargetNetworkManager.Events.ConditionsChanged, updateVisibility);
    manager.addEventListener(SDK.NetworkManager.MultitargetNetworkManager.Events.BlockedPatternsChanged, updateVisibility);
    manager.addEventListener(SDK.NetworkManager.MultitargetNetworkManager.Events.InterceptorsChanged, updateVisibility);
    manager.addEventListener(SDK.NetworkManager.MultitargetNetworkManager.Events.AcceptedEncodingsChanged, updateVisibility);
    updateVisibility();
    function updateVisibility() {
      let icon = null;
      if (manager.isThrottling()) {
        icon = UI.Icon.Icon.create("smallicon-warning");
        UI.Tooltip.Tooltip.install(icon, i18nString(UIStrings.networkThrottlingIsEnabled));
      } else if (SDK.NetworkManager.MultitargetNetworkManager.instance().isIntercepting()) {
        icon = UI.Icon.Icon.create("smallicon-warning");
        UI.Tooltip.Tooltip.install(icon, i18nString(UIStrings.requestsMayBeRewrittenByLocal));
      } else if (manager.isBlocking()) {
        icon = UI.Icon.Icon.create("smallicon-warning");
        UI.Tooltip.Tooltip.install(icon, i18nString(UIStrings.requestsMayBeBlocked));
      } else if (manager.isAcceptedEncodingOverrideSet()) {
        icon = UI.Icon.Icon.create("smallicon-warning");
        UI.Tooltip.Tooltip.install(icon, i18nString(UIStrings.acceptedEncodingOverrideSet));
      }
      UI.InspectorView.InspectorView.instance().setPanelIcon("network", icon);
    }
  }
}
//# sourceMappingURL=NetworkPanelIndicator.js.map
