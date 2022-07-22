import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
import editFileSystemViewStyles from "./editFileSystemView.css.js";
import { Events, IsolatedFileSystemManager } from "./IsolatedFileSystemManager.js";
const UIStrings = {
  excludedFolders: "Excluded folders",
  add: "Add",
  none: "None",
  sViaDevtools: "{PH1} (via .devtools)",
  folderPath: "Folder path",
  enterAPath: "Enter a path",
  enterAUniquePath: "Enter a unique path"
};
const str_ = i18n.i18n.registerUIStrings("models/persistence/EditFileSystemView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class EditFileSystemView extends UI.Widget.VBox {
  fileSystemPath;
  excludedFolders;
  eventListeners;
  excludedFoldersList;
  muteUpdate;
  excludedFolderEditor;
  constructor(fileSystemPath) {
    super(true);
    this.fileSystemPath = fileSystemPath;
    this.excludedFolders = [];
    this.eventListeners = [
      IsolatedFileSystemManager.instance().addEventListener(Events.ExcludedFolderAdded, this.update, this),
      IsolatedFileSystemManager.instance().addEventListener(Events.ExcludedFolderRemoved, this.update, this)
    ];
    const excludedFoldersHeader = this.contentElement.createChild("div", "file-system-header");
    excludedFoldersHeader.createChild("div", "file-system-header-text").textContent = i18nString(UIStrings.excludedFolders);
    excludedFoldersHeader.appendChild(UI.UIUtils.createTextButton(i18nString(UIStrings.add), this.addExcludedFolderButtonClicked.bind(this), "add-button"));
    this.excludedFoldersList = new UI.ListWidget.ListWidget(this);
    this.excludedFoldersList.element.classList.add("file-system-list");
    const excludedFoldersPlaceholder = document.createElement("div");
    excludedFoldersPlaceholder.classList.add("file-system-list-empty");
    excludedFoldersPlaceholder.textContent = i18nString(UIStrings.none);
    this.excludedFoldersList.setEmptyPlaceholder(excludedFoldersPlaceholder);
    this.excludedFoldersList.show(this.contentElement);
    this.update();
  }
  dispose() {
    Common.EventTarget.removeEventListeners(this.eventListeners);
  }
  getFileSystem() {
    return IsolatedFileSystemManager.instance().fileSystem(this.fileSystemPath);
  }
  update() {
    if (this.muteUpdate) {
      return;
    }
    this.excludedFoldersList.clear();
    this.excludedFolders = [];
    for (const folder of this.getFileSystem().excludedFolders().values()) {
      this.excludedFolders.push(folder);
      this.excludedFoldersList.appendItem(folder, true);
    }
  }
  addExcludedFolderButtonClicked() {
    this.excludedFoldersList.addNewItem(0, "");
  }
  renderItem(item, editable) {
    const element = document.createElement("div");
    element.classList.add("file-system-list-item");
    const pathPrefix = editable ? item : i18nString(UIStrings.sViaDevtools, { PH1: item });
    const pathPrefixElement = element.createChild("div", "file-system-value");
    pathPrefixElement.textContent = pathPrefix;
    UI.Tooltip.Tooltip.install(pathPrefixElement, pathPrefix);
    return element;
  }
  removeItemRequested(_item, index) {
    this.getFileSystem().removeExcludedFolder(this.excludedFolders[index]);
  }
  commitEdit(item, editor, isNew) {
    this.muteUpdate = true;
    if (!isNew) {
      this.getFileSystem().removeExcludedFolder(item);
    }
    this.getFileSystem().addExcludedFolder(this.normalizePrefix(editor.control("pathPrefix").value));
    this.muteUpdate = false;
    this.update();
  }
  beginEdit(item) {
    const editor = this.createExcludedFolderEditor();
    editor.control("pathPrefix").value = item;
    return editor;
  }
  createExcludedFolderEditor() {
    if (this.excludedFolderEditor) {
      return this.excludedFolderEditor;
    }
    const editor = new UI.ListWidget.Editor();
    this.excludedFolderEditor = editor;
    const content = editor.contentElement();
    const titles = content.createChild("div", "file-system-edit-row");
    titles.createChild("div", "file-system-value").textContent = i18nString(UIStrings.folderPath);
    const fields = content.createChild("div", "file-system-edit-row");
    fields.createChild("div", "file-system-value").appendChild(editor.createInput("pathPrefix", "text", "/path/to/folder/", pathPrefixValidator.bind(this)));
    return editor;
    function pathPrefixValidator(_item, index, input) {
      const prefix = this.normalizePrefix(input.value.trim());
      if (!prefix) {
        return { valid: false, errorMessage: i18nString(UIStrings.enterAPath) };
      }
      const configurableCount = this.getFileSystem().excludedFolders().size;
      for (let i = 0; i < configurableCount; ++i) {
        if (i !== index && this.excludedFolders[i] === prefix) {
          return { valid: false, errorMessage: i18nString(UIStrings.enterAUniquePath) };
        }
      }
      return { valid: true, errorMessage: void 0 };
    }
  }
  normalizePrefix(prefix) {
    if (!prefix) {
      return "";
    }
    return prefix + (prefix[prefix.length - 1] === "/" ? "" : "/");
  }
  wasShown() {
    super.wasShown();
    this.excludedFoldersList.registerCSSFiles([editFileSystemViewStyles]);
    this.registerCSSFiles([editFileSystemViewStyles]);
  }
}
//# sourceMappingURL=EditFileSystemView.js.map
