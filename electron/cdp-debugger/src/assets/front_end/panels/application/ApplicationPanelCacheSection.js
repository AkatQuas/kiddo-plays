import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as ApplicationComponents from "./components/components.js";
import * as Host from "../../core/host/host.js";
import { ApplicationPanelTreeElement, ExpandableApplicationPanelTreeElement } from "./ApplicationPanelTreeElement.js";
import { ServiceWorkerCacheView } from "./ServiceWorkerCacheViews.js";
const UIStrings = {
  cacheStorage: "Cache Storage",
  backForwardCache: "Back/forward cache",
  refreshCaches: "Refresh Caches",
  delete: "Delete"
};
const str_ = i18n.i18n.registerUIStrings("panels/application/ApplicationPanelCacheSection.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class ServiceWorkerCacheTreeElement extends ExpandableApplicationPanelTreeElement {
  swCacheModel;
  swCacheTreeElements;
  constructor(resourcesPanel) {
    super(resourcesPanel, i18nString(UIStrings.cacheStorage), "CacheStorage");
    const icon = UI.Icon.Icon.create("mediumicon-database", "resource-tree-item");
    this.setLink("https://developer.chrome.com/docs/devtools/storage/cache/?utm_source=devtools");
    this.setLeadingIcons([icon]);
    this.swCacheModel = null;
    this.swCacheTreeElements = /* @__PURE__ */ new Set();
  }
  initialize(model) {
    this.swCacheTreeElements.clear();
    this.swCacheModel = model;
    if (model) {
      for (const cache of model.caches()) {
        this.addCache(model, cache);
      }
    }
    SDK.TargetManager.TargetManager.instance().addModelListener(SDK.ServiceWorkerCacheModel.ServiceWorkerCacheModel, SDK.ServiceWorkerCacheModel.Events.CacheAdded, this.cacheAdded, this);
    SDK.TargetManager.TargetManager.instance().addModelListener(SDK.ServiceWorkerCacheModel.ServiceWorkerCacheModel, SDK.ServiceWorkerCacheModel.Events.CacheRemoved, this.cacheRemoved, this);
  }
  onattach() {
    super.onattach();
    this.listItemElement.addEventListener("contextmenu", this.handleContextMenuEvent.bind(this), true);
  }
  handleContextMenuEvent(event) {
    const contextMenu = new UI.ContextMenu.ContextMenu(event);
    contextMenu.defaultSection().appendItem(i18nString(UIStrings.refreshCaches), this.refreshCaches.bind(this));
    void contextMenu.show();
  }
  refreshCaches() {
    if (this.swCacheModel) {
      this.swCacheModel.refreshCacheNames();
    }
  }
  cacheAdded(event) {
    const { model, cache } = event.data;
    this.addCache(model, cache);
  }
  addCache(model, cache) {
    const swCacheTreeElement = new SWCacheTreeElement(this.resourcesPanel, model, cache);
    this.swCacheTreeElements.add(swCacheTreeElement);
    this.appendChild(swCacheTreeElement);
  }
  cacheRemoved(event) {
    const { model, cache } = event.data;
    const swCacheTreeElement = this.cacheTreeElement(model, cache);
    if (!swCacheTreeElement) {
      return;
    }
    this.removeChild(swCacheTreeElement);
    this.swCacheTreeElements.delete(swCacheTreeElement);
    this.setExpandable(this.childCount() > 0);
  }
  cacheTreeElement(model, cache) {
    for (const cacheTreeElement of this.swCacheTreeElements) {
      if (cacheTreeElement.hasModelAndCache(model, cache)) {
        return cacheTreeElement;
      }
    }
    return null;
  }
}
export class SWCacheTreeElement extends ApplicationPanelTreeElement {
  model;
  cache;
  view;
  constructor(resourcesPanel, model, cache) {
    super(resourcesPanel, cache.cacheName + " - " + cache.securityOrigin, false);
    this.model = model;
    this.cache = cache;
    this.view = null;
    const icon = UI.Icon.Icon.create("mediumicon-table", "resource-tree-item");
    this.setLeadingIcons([icon]);
  }
  get itemURL() {
    return "cache://" + this.cache.cacheId;
  }
  onattach() {
    super.onattach();
    this.listItemElement.addEventListener("contextmenu", this.handleContextMenuEvent.bind(this), true);
  }
  handleContextMenuEvent(event) {
    const contextMenu = new UI.ContextMenu.ContextMenu(event);
    contextMenu.defaultSection().appendItem(i18nString(UIStrings.delete), this.clearCache.bind(this));
    void contextMenu.show();
  }
  clearCache() {
    void this.model.deleteCache(this.cache);
  }
  update(cache) {
    this.cache = cache;
    if (this.view) {
      this.view.update(cache);
    }
  }
  onselect(selectedByUser) {
    super.onselect(selectedByUser);
    if (!this.view) {
      this.view = new ServiceWorkerCacheView(this.model, this.cache);
    }
    this.showView(this.view);
    Host.userMetrics.panelShown(Host.UserMetrics.PanelCodes[Host.UserMetrics.PanelCodes.service_worker_cache]);
    return false;
  }
  hasModelAndCache(model, cache) {
    return this.cache.equals(cache) && this.model === model;
  }
}
export class BackForwardCacheTreeElement extends ApplicationPanelTreeElement {
  view;
  constructor(resourcesPanel) {
    super(resourcesPanel, i18nString(UIStrings.backForwardCache), false);
    const icon = UI.Icon.Icon.create("mediumicon-database", "resource-tree-item");
    this.setLeadingIcons([icon]);
  }
  get itemURL() {
    return "bfcache://";
  }
  onselect(selectedByUser) {
    super.onselect(selectedByUser);
    if (!this.view) {
      this.view = new ApplicationComponents.BackForwardCacheView.BackForwardCacheViewWrapper();
    }
    this.showView(this.view);
    Host.userMetrics.panelShown(Host.UserMetrics.PanelCodes[Host.UserMetrics.PanelCodes.back_forward_cache]);
    return false;
  }
}
//# sourceMappingURL=ApplicationPanelCacheSection.js.map
