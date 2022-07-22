import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
import networkManageCustomHeadersViewStyles from "./networkManageCustomHeadersView.css.js";
const UIStrings = {
  manageHeaderColumns: "Manage Header Columns",
  noCustomHeaders: "No custom headers",
  addCustomHeader: "Add custom header\u2026",
  headerName: "Header Name"
};
const str_ = i18n.i18n.registerUIStrings("panels/network/NetworkManageCustomHeadersView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class NetworkManageCustomHeadersView extends UI.Widget.VBox {
  list;
  columnConfigs;
  addHeaderColumnCallback;
  changeHeaderColumnCallback;
  removeHeaderColumnCallback;
  editor;
  constructor(columnData, addHeaderColumnCallback, changeHeaderColumnCallback, removeHeaderColumnCallback) {
    super(true);
    this.contentElement.classList.add("custom-headers-wrapper");
    this.contentElement.createChild("div", "header").textContent = i18nString(UIStrings.manageHeaderColumns);
    this.list = new UI.ListWidget.ListWidget(this);
    this.list.element.classList.add("custom-headers-list");
    const placeholder = document.createElement("div");
    placeholder.classList.add("custom-headers-list-list-empty");
    placeholder.textContent = i18nString(UIStrings.noCustomHeaders);
    this.list.setEmptyPlaceholder(placeholder);
    this.list.show(this.contentElement);
    this.contentElement.appendChild(UI.UIUtils.createTextButton(i18nString(UIStrings.addCustomHeader), this.addButtonClicked.bind(this), "add-button"));
    this.columnConfigs = /* @__PURE__ */ new Map();
    columnData.forEach((columnData2) => this.columnConfigs.set(columnData2.title.toLowerCase(), columnData2));
    this.addHeaderColumnCallback = addHeaderColumnCallback;
    this.changeHeaderColumnCallback = changeHeaderColumnCallback;
    this.removeHeaderColumnCallback = removeHeaderColumnCallback;
    this.contentElement.tabIndex = 0;
  }
  wasShown() {
    this.headersUpdated();
    this.list.registerCSSFiles([networkManageCustomHeadersViewStyles]);
    this.registerCSSFiles([networkManageCustomHeadersViewStyles]);
  }
  headersUpdated() {
    this.list.clear();
    this.columnConfigs.forEach((headerData) => this.list.appendItem({ header: headerData.title }, headerData.editable));
  }
  addButtonClicked() {
    this.list.addNewItem(this.columnConfigs.size, { header: "" });
  }
  renderItem(item, _editable) {
    const element = document.createElement("div");
    element.classList.add("custom-headers-list-item");
    const header = element.createChild("div", "custom-header-name");
    header.textContent = item.header;
    UI.Tooltip.Tooltip.install(header, item.header);
    return element;
  }
  removeItemRequested(item, _index) {
    this.removeHeaderColumnCallback(item.header);
    this.columnConfigs.delete(item.header.toLowerCase());
    this.headersUpdated();
  }
  commitEdit(item, editor, isNew) {
    const headerId = editor.control("header").value.trim();
    let success;
    if (isNew) {
      success = this.addHeaderColumnCallback(headerId);
    } else {
      success = this.changeHeaderColumnCallback(item.header, headerId);
    }
    if (success && !isNew) {
      this.columnConfigs.delete(item.header.toLowerCase());
    }
    if (success) {
      this.columnConfigs.set(headerId.toLowerCase(), { title: headerId, editable: true });
    }
    this.headersUpdated();
  }
  beginEdit(item) {
    const editor = this.createEditor();
    editor.control("header").value = item.header;
    return editor;
  }
  createEditor() {
    if (this.editor) {
      return this.editor;
    }
    const editor = new UI.ListWidget.Editor();
    this.editor = editor;
    const content = editor.contentElement();
    const titles = content.createChild("div", "custom-headers-edit-row");
    titles.createChild("div", "custom-headers-header").textContent = i18nString(UIStrings.headerName);
    const fields = content.createChild("div", "custom-headers-edit-row");
    fields.createChild("div", "custom-headers-header").appendChild(editor.createInput("header", "text", "x-custom-header", validateHeader.bind(this)));
    return editor;
    function validateHeader(item, _index, _input) {
      let valid = true;
      const headerId = editor.control("header").value.trim().toLowerCase();
      if (this.columnConfigs.has(headerId) && item.header !== headerId) {
        valid = false;
      }
      return { valid, errorMessage: void 0 };
    }
  }
}
//# sourceMappingURL=NetworkManageCustomHeadersView.js.map
