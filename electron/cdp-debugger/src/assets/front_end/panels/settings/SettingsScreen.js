import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Root from "../../core/root/root.js";
import * as IconButton from "../../ui/components/icon_button/icon_button.js";
import * as Components from "../../ui/legacy/components/utils/utils.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as PanelComponents from "./components/components.js";
import settingsScreenStyles from "./settingsScreen.css.js";
const UIStrings = {
  settings: "Settings",
  shortcuts: "Shortcuts",
  preferences: "Preferences",
  restoreDefaultsAndReload: "Restore defaults and reload",
  experiments: "Experiments",
  theseExperimentsCouldBeUnstable: "These experiments could be unstable or unreliable and may require you to restart DevTools.",
  theseExperimentsAreParticularly: "These experiments are particularly unstable. Enable at your own risk.",
  warning: "WARNING:",
  oneOrMoreSettingsHaveChanged: "One or more settings have changed which requires a reload to take effect.",
  filterExperimentsLabel: "Filter",
  noResults: "No experiments match the filter",
  learnMore: "Learn more"
};
const str_ = i18n.i18n.registerUIStrings("panels/settings/SettingsScreen.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let settingsScreenInstance;
export class SettingsScreen extends UI.Widget.VBox {
  tabbedLocation;
  keybindsTab;
  reportTabOnReveal;
  constructor() {
    super(true);
    this.contentElement.classList.add("settings-window-main");
    this.contentElement.classList.add("vbox");
    const settingsLabelElement = document.createElement("div");
    const settingsTitleElement = UI.Utils.createShadowRootWithCoreStyles(settingsLabelElement, { cssFile: [settingsScreenStyles], delegatesFocus: void 0 }).createChild("div", "settings-window-title");
    UI.ARIAUtils.markAsHeading(settingsTitleElement, 1);
    settingsTitleElement.textContent = i18nString(UIStrings.settings);
    this.tabbedLocation = UI.ViewManager.ViewManager.instance().createTabbedLocation(() => SettingsScreen.revealSettingsScreen(), "settings-view");
    const tabbedPane = this.tabbedLocation.tabbedPane();
    tabbedPane.registerCSSFiles([settingsScreenStyles]);
    tabbedPane.leftToolbar().appendToolbarItem(new UI.Toolbar.ToolbarItem(settingsLabelElement));
    tabbedPane.setShrinkableTabs(false);
    tabbedPane.makeVerticalTabLayout();
    const keyBindsView = UI.ViewManager.ViewManager.instance().view("keybinds");
    if (keyBindsView) {
      void keyBindsView.widget().then((widget) => {
        this.keybindsTab = widget;
      });
    }
    tabbedPane.show(this.contentElement);
    tabbedPane.selectTab("preferences");
    tabbedPane.addEventListener(UI.TabbedPane.Events.TabInvoked, this.tabInvoked, this);
    this.reportTabOnReveal = false;
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!settingsScreenInstance || forceNew) {
      settingsScreenInstance = new SettingsScreen();
    }
    return settingsScreenInstance;
  }
  static revealSettingsScreen() {
    const settingsScreen = SettingsScreen.instance();
    if (settingsScreen.isShowing()) {
      return settingsScreen;
    }
    settingsScreen.reportTabOnReveal = true;
    const dialog = new UI.Dialog.Dialog();
    dialog.contentElement.tabIndex = -1;
    dialog.addCloseButton();
    dialog.setOutsideClickCallback(() => {
    });
    dialog.setPointerEventsBehavior(UI.GlassPane.PointerEventsBehavior.PierceGlassPane);
    dialog.setOutsideTabIndexBehavior(UI.Dialog.OutsideTabIndexBehavior.PreserveMainViewTabIndex);
    settingsScreen.show(dialog.contentElement);
    dialog.setEscapeKeyCallback(settingsScreen.onEscapeKeyPressed.bind(settingsScreen));
    dialog.setMarginBehavior(UI.GlassPane.MarginBehavior.NoMargin);
    dialog.show();
    return settingsScreen;
  }
  static async showSettingsScreen(options = { name: void 0, focusTabHeader: void 0 }) {
    const { name, focusTabHeader } = options;
    const settingsScreen = SettingsScreen.revealSettingsScreen();
    settingsScreen.selectTab(name || "preferences");
    const tabbedPane = settingsScreen.tabbedLocation.tabbedPane();
    await tabbedPane.waitForTabElementUpdate();
    if (focusTabHeader) {
      tabbedPane.focusSelectedTabHeader();
    } else {
      tabbedPane.focus();
    }
  }
  resolveLocation(_locationName) {
    return this.tabbedLocation;
  }
  selectTab(name) {
    this.tabbedLocation.tabbedPane().selectTab(name, true);
  }
  tabInvoked(event) {
    const eventData = event.data;
    if (!eventData.isUserGesture) {
      return;
    }
    const prevTabId = eventData.prevTabId;
    const tabId = eventData.tabId;
    if (!this.reportTabOnReveal && prevTabId && prevTabId === tabId) {
      return;
    }
    this.reportTabOnReveal = false;
    this.reportSettingsPanelShown(tabId);
  }
  reportSettingsPanelShown(tabId) {
    if (tabId === i18nString(UIStrings.shortcuts)) {
      Host.userMetrics.settingsPanelShown("shortcuts");
      return;
    }
    Host.userMetrics.settingsPanelShown(tabId);
  }
  onEscapeKeyPressed(event) {
    if (this.tabbedLocation.tabbedPane().selectedTabId === "keybinds" && this.keybindsTab) {
      this.keybindsTab.onEscapeKeyPressed(event);
    }
  }
  wasShown() {
    super.wasShown();
    this.registerCSSFiles([settingsScreenStyles]);
  }
}
class SettingsTab extends UI.Widget.VBox {
  containerElement;
  constructor(name, id) {
    super();
    this.element.classList.add("settings-tab-container");
    if (id) {
      this.element.id = id;
    }
    const header = this.element.createChild("header");
    UI.UIUtils.createTextChild(header.createChild("h1"), name);
    this.containerElement = this.element.createChild("div", "settings-container-wrapper").createChild("div", "settings-tab settings-content settings-container");
  }
  appendSection(name) {
    const block = this.containerElement.createChild("div", "settings-block");
    if (name) {
      UI.ARIAUtils.markAsGroup(block);
      const title = block.createChild("div", "settings-section-title");
      title.textContent = name;
      UI.ARIAUtils.markAsHeading(title, 2);
      UI.ARIAUtils.setAccessibleName(block, name);
    }
    return block;
  }
}
let genericSettingsTabInstance;
export class GenericSettingsTab extends SettingsTab {
  syncSection = new PanelComponents.SyncSection.SyncSection();
  constructor() {
    super(i18nString(UIStrings.preferences), "preferences-tab-content");
    const explicitSectionOrder = [
      Common.Settings.SettingCategory.NONE,
      Common.Settings.SettingCategory.APPEARANCE,
      Common.Settings.SettingCategory.SOURCES,
      Common.Settings.SettingCategory.ELEMENTS,
      Common.Settings.SettingCategory.NETWORK,
      Common.Settings.SettingCategory.PERFORMANCE,
      Common.Settings.SettingCategory.MEMORY,
      Common.Settings.SettingCategory.CONSOLE,
      Common.Settings.SettingCategory.EXTENSIONS,
      Common.Settings.SettingCategory.PERSISTENCE,
      Common.Settings.SettingCategory.DEBUGGER,
      Common.Settings.SettingCategory.GLOBAL
    ];
    if (Root.Runtime.experiments.isEnabled(Root.Runtime.ExperimentName.SYNC_SETTINGS)) {
      explicitSectionOrder.push(Common.Settings.SettingCategory.SYNC);
    }
    const preRegisteredSettings = Common.Settings.getRegisteredSettings().sort((firstSetting, secondSetting) => {
      if (firstSetting.order && secondSetting.order) {
        return firstSetting.order - secondSetting.order;
      }
      if (firstSetting.order) {
        return -1;
      }
      if (secondSetting.order) {
        return 1;
      }
      return 0;
    });
    for (const sectionCategory of explicitSectionOrder) {
      const settingsForSection = preRegisteredSettings.filter((setting) => setting.category === sectionCategory && GenericSettingsTab.isSettingVisible(setting));
      this.createSectionElement(sectionCategory, settingsForSection);
    }
    this.appendSection().appendChild(UI.UIUtils.createTextButton(i18nString(UIStrings.restoreDefaultsAndReload), restoreAndReload));
    function restoreAndReload() {
      Common.Settings.Settings.instance().clearAll();
      Components.Reload.reload();
    }
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!genericSettingsTabInstance || forceNew) {
      genericSettingsTabInstance = new GenericSettingsTab();
    }
    return genericSettingsTabInstance;
  }
  static isSettingVisible(setting) {
    const titleMac = setting.titleMac && setting.titleMac();
    const defaultTitle = setting.title && setting.title();
    const title = titleMac || defaultTitle;
    return Boolean(title && setting.category);
  }
  wasShown() {
    super.wasShown();
    this.updateSyncSection();
  }
  updateSyncSection() {
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.getSyncInformation((syncInfo) => {
      this.syncSection.data = {
        syncInfo,
        syncSetting: Common.Settings.moduleSetting("sync_preferences")
      };
    });
  }
  createExtensionSection(settings) {
    const sectionName = Common.Settings.SettingCategory.EXTENSIONS;
    const settingUI = Components.Linkifier.LinkHandlerSettingUI.instance();
    const element = settingUI.settingElement();
    if (element) {
      const sectionElement = this.createStandardSectionElement(sectionName, settings);
      sectionElement.appendChild(element);
    }
  }
  createSectionElement(category, settings) {
    if (category === Common.Settings.SettingCategory.EXTENSIONS) {
      this.createExtensionSection(settings);
    } else if (category === Common.Settings.SettingCategory.SYNC && settings.length > 0) {
      this.containerElement.appendChild(this.syncSection);
    } else if (settings.length > 0) {
      this.createStandardSectionElement(category, settings);
    }
  }
  createStandardSectionElement(category, settings) {
    const uiSectionName = Common.Settings.getLocalizedSettingsCategory(category);
    const sectionElement = this.appendSection(uiSectionName);
    for (const settingRegistration of settings) {
      const setting = Common.Settings.Settings.instance().moduleSetting(settingRegistration.settingName);
      const settingControl = UI.SettingsUI.createControlForSetting(setting);
      if (settingControl) {
        sectionElement.appendChild(settingControl);
      }
    }
    return sectionElement;
  }
}
let experimentsSettingsTabInstance;
export class ExperimentsSettingsTab extends SettingsTab {
  experimentsSection;
  unstableExperimentsSection;
  constructor() {
    super(i18nString(UIStrings.experiments), "experiments-tab-content");
    const filterSection = this.appendSection();
    filterSection.classList.add("experiments-filter");
    const labelElement = filterSection.createChild("label");
    labelElement.textContent = i18nString(UIStrings.filterExperimentsLabel);
    const inputElement = UI.UIUtils.createInput("", "text");
    UI.ARIAUtils.bindLabelToControl(labelElement, inputElement);
    filterSection.appendChild(inputElement);
    inputElement.addEventListener("input", () => this.renderExperiments(inputElement.value.toLowerCase()), false);
    this.renderExperiments("");
  }
  renderExperiments(filterText) {
    if (this.experimentsSection) {
      this.experimentsSection.remove();
    }
    if (this.unstableExperimentsSection) {
      this.unstableExperimentsSection.remove();
    }
    const experiments = Root.Runtime.experiments.allConfigurableExperiments().sort();
    const unstableExperiments = experiments.filter((e) => e.unstable && e.title.toLowerCase().includes(filterText));
    const stableExperiments = experiments.filter((e) => !e.unstable && e.title.toLowerCase().includes(filterText));
    if (stableExperiments.length) {
      this.experimentsSection = this.appendSection();
      const warningMessage = i18nString(UIStrings.theseExperimentsCouldBeUnstable);
      this.experimentsSection.appendChild(this.createExperimentsWarningSubsection(warningMessage));
      for (const experiment of stableExperiments) {
        this.experimentsSection.appendChild(this.createExperimentCheckbox(experiment));
      }
    }
    if (unstableExperiments.length) {
      this.unstableExperimentsSection = this.appendSection();
      const warningMessage = i18nString(UIStrings.theseExperimentsAreParticularly);
      this.unstableExperimentsSection.appendChild(this.createExperimentsWarningSubsection(warningMessage));
      for (const experiment of unstableExperiments) {
        this.unstableExperimentsSection.appendChild(this.createExperimentCheckbox(experiment));
      }
    }
    if (!stableExperiments.length && !unstableExperiments.length) {
      this.experimentsSection = this.appendSection();
      const warning = this.experimentsSection.createChild("span");
      warning.textContent = i18nString(UIStrings.noResults);
    }
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!experimentsSettingsTabInstance || forceNew) {
      experimentsSettingsTabInstance = new ExperimentsSettingsTab();
    }
    return experimentsSettingsTabInstance;
  }
  createExperimentsWarningSubsection(warningMessage) {
    const subsection = document.createElement("div");
    const warning = subsection.createChild("span", "settings-experiments-warning-subsection-warning");
    warning.textContent = i18nString(UIStrings.warning);
    UI.UIUtils.createTextChild(subsection, " ");
    const message = subsection.createChild("span", "settings-experiments-warning-subsection-message");
    message.textContent = warningMessage;
    return subsection;
  }
  createExperimentCheckbox(experiment) {
    const label = UI.UIUtils.CheckboxLabel.create(experiment.title, experiment.isEnabled());
    const input = label.checkboxElement;
    input.name = experiment.name;
    function listener() {
      experiment.setEnabled(input.checked);
      Host.userMetrics.experimentChanged(experiment.name, experiment.isEnabled());
      UI.InspectorView.InspectorView.instance().displayReloadRequiredWarning(i18nString(UIStrings.oneOrMoreSettingsHaveChanged));
    }
    input.addEventListener("click", listener, false);
    const p = document.createElement("p");
    p.classList.add("settings-experiment");
    if (experiment.unstable && !experiment.isEnabled()) {
      p.classList.add("settings-experiment-unstable");
    }
    p.appendChild(label);
    if (experiment.docLink) {
      const link = UI.XLink.XLink.create(experiment.docLink);
      link.textContent = "";
      link.setAttribute("aria-label", i18nString(UIStrings.learnMore));
      const linkIcon = new IconButton.Icon.Icon();
      linkIcon.data = { iconName: "help_outline", color: "var(--color-text-secondary)", width: "16px", height: "16px" };
      linkIcon.classList.add("link-icon");
      link.prepend(linkIcon);
      p.appendChild(link);
    }
    return p;
  }
}
let actionDelegateInstance;
export class ActionDelegate {
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!actionDelegateInstance || forceNew) {
      actionDelegateInstance = new ActionDelegate();
    }
    return actionDelegateInstance;
  }
  handleAction(context, actionId) {
    switch (actionId) {
      case "settings.show":
        void SettingsScreen.showSettingsScreen({ focusTabHeader: true });
        return true;
      case "settings.documentation":
        Host.InspectorFrontendHost.InspectorFrontendHostInstance.openInNewTab(UI.UIUtils.addReferrerToURL("https://developer.chrome.com/docs/devtools/"));
        return true;
      case "settings.shortcuts":
        void SettingsScreen.showSettingsScreen({ name: "keybinds", focusTabHeader: true });
        return true;
    }
    return false;
  }
}
let revealerInstance;
export class Revealer {
  static instance(opts = { forceNew: false }) {
    const { forceNew } = opts;
    if (!revealerInstance || forceNew) {
      revealerInstance = new Revealer();
    }
    return revealerInstance;
  }
  reveal(object) {
    console.assert(object instanceof Common.Settings.Setting);
    const setting = object;
    let success = false;
    for (const settingRegistration of Common.Settings.getRegisteredSettings()) {
      if (!GenericSettingsTab.isSettingVisible(settingRegistration)) {
        continue;
      }
      if (settingRegistration.settingName === setting.name) {
        Host.InspectorFrontendHost.InspectorFrontendHostInstance.bringToFront();
        void SettingsScreen.showSettingsScreen();
        success = true;
      }
    }
    for (const view of UI.ViewManager.getRegisteredViewExtensions()) {
      const id = view.viewId();
      const location = view.location();
      if (location !== UI.ViewManager.ViewLocationValues.SETTINGS_VIEW) {
        continue;
      }
      const settings = view.settings();
      if (settings && settings.indexOf(setting.name) !== -1) {
        Host.InspectorFrontendHost.InspectorFrontendHostInstance.bringToFront();
        void SettingsScreen.showSettingsScreen({ name: id });
        success = true;
      }
    }
    return success ? Promise.resolve() : Promise.reject();
  }
}
//# sourceMappingURL=SettingsScreen.js.map
