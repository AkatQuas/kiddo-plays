import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as UI from "../../ui/legacy/legacy.js";
import { DeveloperResourcesListView } from "./DeveloperResourcesListView.js";
import developerResourcesViewStyles from "./developerResourcesView.css.js";
const UIStrings = {
  enterTextToSearchTheUrlAndError: "Enter text to search the URL and Error columns",
  loadHttpsDeveloperResources: "Load `HTTP(S)` developer resources through the inspected target",
  enableLoadingThroughTarget: "Enable loading through target",
  resourcesCurrentlyLoading: "{PH1} resources, {PH2} currently loading",
  resources: "{n, plural, =1 {# resource} other {# resources}}"
};
const str_ = i18n.i18n.registerUIStrings("panels/developer_resources/DeveloperResourcesView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let developerResourcesViewInstance;
export class DeveloperResourcesView extends UI.Widget.VBox {
  textFilterRegExp;
  filterInput;
  coverageResultsElement;
  listView;
  statusToolbarElement;
  statusMessageElement;
  throttler;
  loader;
  constructor() {
    super(true);
    const toolbarContainer = this.contentElement.createChild("div", "developer-resource-view-toolbar-container");
    const toolbar = new UI.Toolbar.Toolbar("developer-resource-view-toolbar", toolbarContainer);
    this.textFilterRegExp = null;
    const accessiblePlaceholder = "";
    this.filterInput = new UI.Toolbar.ToolbarInput(i18nString(UIStrings.enterTextToSearchTheUrlAndError), accessiblePlaceholder, 1);
    this.filterInput.addEventListener(UI.Toolbar.ToolbarInput.Event.TextChanged, this.onFilterChanged, this);
    toolbar.appendToolbarItem(this.filterInput);
    const loadThroughTarget = SDK.PageResourceLoader.getLoadThroughTargetSetting();
    const loadThroughTargetCheckbox = new UI.Toolbar.ToolbarSettingCheckbox(loadThroughTarget, i18nString(UIStrings.loadHttpsDeveloperResources), i18nString(UIStrings.enableLoadingThroughTarget));
    toolbar.appendToolbarItem(loadThroughTargetCheckbox);
    this.coverageResultsElement = this.contentElement.createChild("div", "developer-resource-view-results");
    this.listView = new DeveloperResourcesListView(this.isVisible.bind(this));
    this.listView.show(this.coverageResultsElement);
    this.statusToolbarElement = this.contentElement.createChild("div", "developer-resource-view-toolbar-summary");
    this.statusMessageElement = this.statusToolbarElement.createChild("div", "developer-resource-view-message");
    this.throttler = new Common.Throttler.Throttler(100);
    this.loader = SDK.PageResourceLoader.PageResourceLoader.instance();
    this.loader.addEventListener(SDK.PageResourceLoader.Events.Update, this.onUpdate, this);
    this.onUpdate();
  }
  static instance() {
    if (!developerResourcesViewInstance) {
      developerResourcesViewInstance = new DeveloperResourcesView();
    }
    return developerResourcesViewInstance;
  }
  onUpdate() {
    void this.throttler.schedule(this.update.bind(this));
  }
  async update() {
    this.listView.reset();
    this.listView.update(this.loader.getResourcesLoaded().values());
    this.updateStats();
  }
  updateStats() {
    const { loading, resources } = this.loader.getNumberOfResources();
    if (loading > 0) {
      this.statusMessageElement.textContent = i18nString(UIStrings.resourcesCurrentlyLoading, { PH1: resources, PH2: loading });
    } else {
      this.statusMessageElement.textContent = i18nString(UIStrings.resources, { n: resources });
    }
  }
  isVisible(item) {
    return !this.textFilterRegExp || this.textFilterRegExp.test(item.url) || this.textFilterRegExp.test(item.errorMessage || "");
  }
  onFilterChanged() {
    if (!this.listView) {
      return;
    }
    const text = this.filterInput.value();
    this.textFilterRegExp = text ? Platform.StringUtilities.createPlainTextSearchRegex(text, "i") : null;
    this.listView.updateFilterAndHighlight(this.textFilterRegExp);
    this.updateStats();
  }
  wasShown() {
    super.wasShown();
    this.registerCSSFiles([developerResourcesViewStyles]);
  }
}
//# sourceMappingURL=DeveloperResourcesView.js.map
