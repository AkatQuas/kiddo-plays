import "../shell/shell.js";
import "../../panels/js_profiler/js_profiler-meta.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as Common from "../../core/common/common.js";
import * as Root from "../../core/root/root.js";
import * as Main from "../main/main.js";
import { NodeMainImpl } from "./NodeMain.js";
import { NodeConnectionsPanel } from "./NodeConnectionsPanel.js";
const UIStrings = {
  connection: "Connection",
  node: "node",
  showConnection: "Show Connection",
  networkTitle: "Node",
  showNode: "Node"
};
const str_ = i18n.i18n.registerUIStrings("entrypoints/node_app/node_app.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedSourcesModule;
async function loadSourcesModule() {
  if (!loadedSourcesModule) {
    loadedSourcesModule = await import("../../panels/sources/sources.js");
  }
  return loadedSourcesModule;
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.PANEL,
  id: "node-connection",
  title: i18nLazyString(UIStrings.connection),
  commandPrompt: i18nLazyString(UIStrings.showConnection),
  order: 0,
  async loadView() {
    return NodeConnectionsPanel.instance();
  },
  tags: [i18nLazyString(UIStrings.node)]
});
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.NAVIGATOR_VIEW,
  id: "navigator-network",
  title: i18nLazyString(UIStrings.networkTitle),
  commandPrompt: i18nLazyString(UIStrings.showNode),
  order: 2,
  persistence: UI.ViewManager.ViewPersistence.PERMANENT,
  async loadView() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesNavigator.NetworkNavigatorView.instance();
  }
});
self.runtime = Root.Runtime.Runtime.instance({ forceNew: true });
Common.Runnable.registerEarlyInitializationRunnable(NodeMainImpl.instance);
new Main.MainImpl.MainImpl();
//# sourceMappingURL=node_app.js.map
