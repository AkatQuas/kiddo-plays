import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as DataGrid from "../../ui/legacy/components/data_grid/data_grid.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  databaseQuery: "Database Query",
  queryS: "Query: {PH1}"
};
const str_ = i18n.i18n.registerUIStrings("panels/application/DatabaseQueryView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class DatabaseQueryView extends Common.ObjectWrapper.eventMixin(UI.Widget.VBox) {
  database;
  queryWrapper;
  promptContainer;
  promptElement;
  prompt;
  proxyElement;
  queryResults;
  virtualSelectedIndex;
  lastSelectedElement;
  selectionTimeout;
  constructor(database) {
    super();
    this.database = database;
    this.element.classList.add("storage-view", "query", "monospace");
    this.element.addEventListener("selectstart", this.selectStart.bind(this), false);
    this.queryWrapper = this.element.createChild("div", "database-query-group-messages");
    this.queryWrapper.addEventListener("focusin", this.onFocusIn.bind(this));
    this.queryWrapper.addEventListener("focusout", this.onFocusOut.bind(this));
    this.queryWrapper.addEventListener("keydown", this.onKeyDown.bind(this));
    this.queryWrapper.tabIndex = -1;
    this.promptContainer = this.element.createChild("div", "database-query-prompt-container");
    this.promptContainer.appendChild(UI.Icon.Icon.create("smallicon-text-prompt", "prompt-icon"));
    this.promptElement = this.promptContainer.createChild("div");
    this.promptElement.className = "database-query-prompt";
    this.promptElement.addEventListener("keydown", this.promptKeyDown.bind(this));
    this.prompt = new UI.TextPrompt.TextPrompt();
    this.prompt.initialize(this.completions.bind(this), " ");
    this.proxyElement = this.prompt.attach(this.promptElement);
    this.element.addEventListener("click", this.messagesClicked.bind(this), true);
    this.queryResults = [];
    this.virtualSelectedIndex = -1;
    this.selectionTimeout = 0;
  }
  messagesClicked() {
    this.prompt.focus();
    if (!this.prompt.isCaretInsidePrompt() && !this.element.hasSelection()) {
      this.prompt.moveCaretToEndOfPrompt();
    }
  }
  onKeyDown(event) {
    if (UI.UIUtils.isEditing() || !this.queryResults.length || event.shiftKey) {
      return;
    }
    switch (event.key) {
      case "ArrowUp":
        if (this.virtualSelectedIndex > 0) {
          this.virtualSelectedIndex--;
        } else {
          return;
        }
        break;
      case "ArrowDown":
        if (this.virtualSelectedIndex < this.queryResults.length - 1) {
          this.virtualSelectedIndex++;
        } else {
          return;
        }
        break;
      case "Home":
        this.virtualSelectedIndex = 0;
        break;
      case "End":
        this.virtualSelectedIndex = this.queryResults.length - 1;
        break;
      default:
        return;
    }
    event.consume(true);
    this.updateFocusedItem();
  }
  onFocusIn(event) {
    if (this.virtualSelectedIndex === -1 && this.isOutsideViewport(event.relatedTarget) && event.target === this.queryWrapper && this.queryResults.length) {
      this.virtualSelectedIndex = this.queryResults.length - 1;
    }
    this.updateFocusedItem();
  }
  onFocusOut(event) {
    if (this.isOutsideViewport(event.relatedTarget)) {
      this.virtualSelectedIndex = -1;
    }
    this.updateFocusedItem();
    this.queryWrapper.scrollTop = 1e7;
  }
  isOutsideViewport(element) {
    return element !== null && !element.isSelfOrDescendant(this.queryWrapper);
  }
  updateFocusedItem() {
    let index = this.virtualSelectedIndex;
    if (this.queryResults.length && this.virtualSelectedIndex < 0) {
      index = this.queryResults.length - 1;
    }
    const selectedElement = index >= 0 ? this.queryResults[index] : null;
    const changed = this.lastSelectedElement !== selectedElement;
    const containerHasFocus = this.queryWrapper === Platform.DOMUtilities.deepActiveElement(this.element.ownerDocument);
    if (selectedElement && (changed || containerHasFocus) && this.element.hasFocus()) {
      if (!selectedElement.hasFocus()) {
        selectedElement.focus();
      }
    }
    if (this.queryResults.length && !this.queryWrapper.hasFocus()) {
      this.queryWrapper.tabIndex = 0;
    } else {
      this.queryWrapper.tabIndex = -1;
    }
    this.lastSelectedElement = selectedElement;
  }
  async completions(_expression, prefix, _force) {
    if (!prefix) {
      return [];
    }
    prefix = prefix.toLowerCase();
    const tableNames = await this.database.tableNames();
    return tableNames.map((name) => name + " ").concat(SQL_BUILT_INS).filter((proposal) => proposal.toLowerCase().startsWith(prefix)).map((completion) => ({ text: completion }));
  }
  selectStart(_event) {
    if (this.selectionTimeout) {
      clearTimeout(this.selectionTimeout);
    }
    this.prompt.clearAutocomplete();
    function moveBackIfOutside() {
      this.selectionTimeout = 0;
      if (!this.prompt.isCaretInsidePrompt() && !this.element.hasSelection()) {
        this.prompt.moveCaretToEndOfPrompt();
      }
      this.prompt.autoCompleteSoon();
    }
    this.selectionTimeout = window.setTimeout(moveBackIfOutside.bind(this), 100);
  }
  promptKeyDown(event) {
    if (event.key === "Enter") {
      void this.enterKeyPressed(event);
      return;
    }
  }
  async enterKeyPressed(event) {
    event.consume(true);
    const query = this.prompt.textWithCurrentSuggestion();
    this.prompt.clearAutocomplete();
    if (!query.length) {
      return;
    }
    this.prompt.setEnabled(false);
    try {
      const result = await new Promise((resolve, reject) => {
        void this.database.executeSql(query, (columnNames, values) => resolve({ columnNames, values }), (errorText) => reject(errorText));
      });
      this.queryFinished(query, result.columnNames, result.values);
    } catch (e) {
      this.appendErrorQueryResult(query, e);
    }
    this.prompt.setEnabled(true);
    this.prompt.setText("");
    this.prompt.focus();
  }
  queryFinished(query, columnNames, values) {
    const dataGrid = DataGrid.SortableDataGrid.SortableDataGrid.create(columnNames, values, i18nString(UIStrings.databaseQuery));
    const trimmedQuery = query.trim();
    let view = null;
    if (dataGrid) {
      dataGrid.setStriped(true);
      dataGrid.renderInline();
      dataGrid.autoSizeColumns(5);
      view = dataGrid.asWidget();
      dataGrid.setFocusable(false);
    }
    this.appendViewQueryResult(trimmedQuery, view);
    if (trimmedQuery.match(/^create /i) || trimmedQuery.match(/^drop table /i)) {
      this.dispatchEventToListeners(Events.SchemaUpdated, this.database);
    }
  }
  appendViewQueryResult(query, view) {
    const resultElement = this.appendQueryResult(query);
    if (view) {
      view.show(resultElement);
    } else {
      resultElement.remove();
    }
    this.scrollResultIntoView();
  }
  appendErrorQueryResult(query, errorText) {
    const resultElement = this.appendQueryResult(query);
    resultElement.classList.add("error");
    resultElement.appendChild(UI.Icon.Icon.create("smallicon-error", "prompt-icon"));
    UI.UIUtils.createTextChild(resultElement, errorText);
    this.scrollResultIntoView();
  }
  scrollResultIntoView() {
    this.queryResults[this.queryResults.length - 1].scrollIntoView(false);
    this.promptElement.scrollIntoView(false);
  }
  appendQueryResult(query) {
    const element = document.createElement("div");
    element.className = "database-user-query";
    element.tabIndex = -1;
    UI.ARIAUtils.setAccessibleName(element, i18nString(UIStrings.queryS, { PH1: query }));
    this.queryResults.push(element);
    this.updateFocusedItem();
    element.appendChild(UI.Icon.Icon.create("smallicon-user-command", "prompt-icon"));
    const commandTextElement = document.createElement("span");
    commandTextElement.className = "database-query-text";
    commandTextElement.textContent = query;
    element.appendChild(commandTextElement);
    const resultElement = document.createElement("div");
    resultElement.className = "database-query-result";
    element.appendChild(resultElement);
    this.queryWrapper.appendChild(element);
    return resultElement;
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["SchemaUpdated"] = "SchemaUpdated";
  return Events2;
})(Events || {});
export const SQL_BUILT_INS = [
  "SELECT ",
  "FROM ",
  "WHERE ",
  "LIMIT ",
  "DELETE FROM ",
  "CREATE ",
  "DROP ",
  "TABLE ",
  "INDEX ",
  "UPDATE ",
  "INSERT INTO ",
  "VALUES ("
];
//# sourceMappingURL=DatabaseQueryView.js.map
