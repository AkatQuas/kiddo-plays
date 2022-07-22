import * as i18n from "../../core/i18n/i18n.js";
import * as Root from "../../core/root/root.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  protocolMonitor: "Protocol monitor",
  showProtocolMonitor: "Show Protocol monitor"
};
const str_ = i18n.i18n.registerUIStrings("panels/protocol_monitor/protocol_monitor-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedProtocolMonitorModule;
async function loadProtocolMonitorModule() {
  if (!loadedProtocolMonitorModule) {
    loadedProtocolMonitorModule = await import("./protocol_monitor.js");
  }
  return loadedProtocolMonitorModule;
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.DRAWER_VIEW,
  id: "protocol-monitor",
  title: i18nLazyString(UIStrings.protocolMonitor),
  commandPrompt: i18nLazyString(UIStrings.showProtocolMonitor),
  order: 100,
  persistence: UI.ViewManager.ViewPersistence.CLOSEABLE,
  async loadView() {
    const ProtocolMonitor = await loadProtocolMonitorModule();
    return ProtocolMonitor.ProtocolMonitor.ProtocolMonitorImpl.instance();
  },
  experiment: Root.Runtime.ExperimentName.PROTOCOL_MONITOR
});
//# sourceMappingURL=protocol_monitor-meta.js.map
