import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
import { EditFileSystemView } from "./EditFileSystemView.js";
import workspaceSettingsTabStyles from "./workspaceSettingsTab.css.js";
import { IsolatedFileSystem } from "./IsolatedFileSystem.js";
import { Events, IsolatedFileSystemManager } from "./IsolatedFileSystemManager.js";
import { NetworkPersistenceManager } from "./NetworkPersistenceManager.js";
const UIStrings = {
  workspace: "Workspace",
  mappingsAreInferredAutomatically: "Mappings are inferred automatically.",
  addFolder: "Add folder\u2026",
  folderExcludePattern: "Folder exclude pattern",
  remove: "Remove"
};
const str_ = i18n.i18n.registerUIStrings("models/persistence/WorkspaceSettingsTab.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let workspaceSettingsTabInstance;
export class WorkspaceSettingsTab extends UI.Widget.VBox {
  containerElement;
  fileSystemsListContainer;
  elementByPath;
  mappingViewByPath;
  constructor() {
    super();
    this.element.classList.add("workspace-settings-tab");
    const header = this.element.createChild("header");
    UI.UIUtils.createTextChild(header.createChild("h1"), i18nString(UIStrings.workspace));
    this.containerElement = this.element.createChild("div", "settings-container-wrapper").createChild("div", "settings-tab settings-content settings-container");
    IsolatedFileSystemManager.instance().addEventListener(Events.FileSystemAdded, (event) => this.fileSystemAdded(event.data), this);
    IsolatedFileSystemManager.instance().addEventListener(Events.FileSystemRemoved, (event) => this.fileSystemRemoved(event.data), this);
    const folderExcludePatternInput = this.createFolderExcludePatternInput();
    folderExcludePatternInput.classList.add("folder-exclude-pattern");
    this.containerElement.appendChild(folderExcludePatternInput);
    const div = this.containerElement.createChild("div", "settings-info-message");
    UI.UIUtils.createTextChild(div, i18nString(UIStrings.mappingsAreInferredAutomatically));
    this.fileSystemsListContainer = this.containerElement.createChild("div", "");
    const addButton = UI.UIUtils.createTextButton(i18nString(UIStrings.addFolder), this.addFileSystemClicked.bind(this));
    this.containerElement.appendChild(addButton);
    this.setDefaultFocusedElement(addButton);
    this.elementByPath = /* @__PURE__ */ new Map();
    this.mappingViewByPath = /* @__PURE__ */ new Map();
    const fileSystems = IsolatedFileSystemManager.instance().fileSystems();
    for (let i = 0; i < fileSystems.length; ++i) {
      this.addItem(fileSystems[i]);
    }
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!workspaceSettingsTabInstance || forceNew) {
      workspaceSettingsTabInstance = new WorkspaceSettingsTab();
    }
    return workspaceSettingsTabInstance;
  }
  wasShown() {
    super.wasShown();
    this.registerCSSFiles([workspaceSettingsTabStyles]);
  }
  createFolderExcludePatternInput() {
    const p = document.createElement("p");
    const labelElement = p.createChild("label");
    labelElement.textContent = i18nString(UIStrings.folderExcludePattern);
    const inputElement = UI.UIUtils.createInput("", "text");
    UI.ARIAUtils.bindLabelToControl(labelElement, inputElement);
    p.appendChild(inputElement);
    const folderExcludeSetting = IsolatedFileSystemManager.instance().workspaceFolderExcludePatternSetting();
    const setValue = UI.UIUtils.bindInput(inputElement, folderExcludeSetting.set.bind(folderExcludeSetting), regexValidator, false);
    folderExcludeSetting.addChangeListener(() => setValue.call(null, folderExcludeSetting.get()));
    setValue(folderExcludeSetting.get());
    return p;
    function regexValidator(value) {
      let regex;
      try {
        regex = new RegExp(value);
      } catch (e) {
      }
      const valid = Boolean(regex);
      return { valid, errorMessage: void 0 };
    }
  }
  addItem(fileSystem) {
    if (!(fileSystem instanceof IsolatedFileSystem)) {
      return;
    }
    const networkPersistenceProject = NetworkPersistenceManager.instance().project();
    if (networkPersistenceProject && IsolatedFileSystemManager.instance().fileSystem(networkPersistenceProject.fileSystemPath()) === fileSystem) {
      return;
    }
    const element = this.renderFileSystem(fileSystem);
    this.elementByPath.set(fileSystem.path(), element);
    this.fileSystemsListContainer.appendChild(element);
    const mappingView = new EditFileSystemView(fileSystem.path());
    this.mappingViewByPath.set(fileSystem.path(), mappingView);
    mappingView.element.classList.add("file-system-mapping-view");
    mappingView.show(element);
  }
  renderFileSystem(fileSystem) {
    const fileSystemPath = fileSystem.path();
    const lastIndexOfSlash = fileSystemPath.lastIndexOf("/");
    const folderName = fileSystemPath.substr(lastIndexOfSlash + 1);
    const element = document.createElement("div");
    element.classList.add("file-system-container");
    const header = element.createChild("div", "file-system-header");
    const nameElement = header.createChild("div", "file-system-name");
    nameElement.textContent = folderName;
    UI.ARIAUtils.markAsHeading(nameElement, 2);
    const path = header.createChild("div", "file-system-path");
    path.textContent = fileSystemPath;
    UI.Tooltip.Tooltip.install(path, fileSystemPath);
    const toolbar = new UI.Toolbar.Toolbar("");
    const button = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.remove), "largeicon-delete");
    button.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, this.removeFileSystemClicked.bind(this, fileSystem));
    toolbar.appendToolbarItem(button);
    header.appendChild(toolbar.element);
    return element;
  }
  removeFileSystemClicked(fileSystem) {
    IsolatedFileSystemManager.instance().removeFileSystem(fileSystem);
  }
  addFileSystemClicked() {
    void IsolatedFileSystemManager.instance().addFileSystem();
  }
  fileSystemAdded(fileSystem) {
    this.addItem(fileSystem);
  }
  fileSystemRemoved(fileSystem) {
    const mappingView = this.mappingViewByPath.get(fileSystem.path());
    if (mappingView) {
      mappingView.dispose();
      this.mappingViewByPath.delete(fileSystem.path());
    }
    const element = this.elementByPath.get(fileSystem.path());
    if (element) {
      this.elementByPath.delete(fileSystem.path());
      element.remove();
    }
  }
}
//# sourceMappingURL=WorkspaceSettingsTab.js.map
