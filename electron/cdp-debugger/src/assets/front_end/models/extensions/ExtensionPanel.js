import * as SDK from "../../core/sdk/sdk.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as ExtensionAPI from "./ExtensionAPI.js";
import { ExtensionNotifierView, ExtensionView } from "./ExtensionView.js";
export class ExtensionPanel extends UI.Panel.Panel {
  server;
  id;
  panelToolbar;
  searchableViewInternal;
  constructor(server, panelName, id, pageURL) {
    super(panelName);
    this.server = server;
    this.id = id;
    this.setHideOnDetach();
    this.panelToolbar = new UI.Toolbar.Toolbar("hidden", this.element);
    this.searchableViewInternal = new UI.SearchableView.SearchableView(this, null);
    this.searchableViewInternal.show(this.element);
    const extensionView = new ExtensionView(server, this.id, pageURL, "extension");
    extensionView.show(this.searchableViewInternal.element);
  }
  addToolbarItem(item) {
    this.panelToolbar.element.classList.remove("hidden");
    this.panelToolbar.appendToolbarItem(item);
  }
  searchCanceled() {
    this.server.notifySearchAction(this.id, ExtensionAPI.PrivateAPI.Panels.SearchAction.CancelSearch);
    this.searchableViewInternal.updateSearchMatchesCount(0);
  }
  searchableView() {
    return this.searchableViewInternal;
  }
  performSearch(searchConfig, _shouldJump, _jumpBackwards) {
    const query = searchConfig.query;
    this.server.notifySearchAction(this.id, ExtensionAPI.PrivateAPI.Panels.SearchAction.PerformSearch, query);
  }
  jumpToNextSearchResult() {
    this.server.notifySearchAction(this.id, ExtensionAPI.PrivateAPI.Panels.SearchAction.NextSearchResult);
  }
  jumpToPreviousSearchResult() {
    this.server.notifySearchAction(this.id, ExtensionAPI.PrivateAPI.Panels.SearchAction.PreviousSearchResult);
  }
  supportsCaseSensitiveSearch() {
    return false;
  }
  supportsRegexSearch() {
    return false;
  }
}
export class ExtensionButton {
  id;
  toolbarButtonInternal;
  constructor(server, id, iconURL, tooltip, disabled) {
    this.id = id;
    this.toolbarButtonInternal = new UI.Toolbar.ToolbarButton("", "");
    this.toolbarButtonInternal.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, server.notifyButtonClicked.bind(server, this.id));
    this.update(iconURL, tooltip, disabled);
  }
  update(iconURL, tooltip, disabled) {
    if (typeof iconURL === "string") {
      this.toolbarButtonInternal.setBackgroundImage(iconURL);
    }
    if (typeof tooltip === "string") {
      this.toolbarButtonInternal.setTitle(tooltip);
    }
    if (typeof disabled === "boolean") {
      this.toolbarButtonInternal.setEnabled(!disabled);
    }
  }
  toolbarButton() {
    return this.toolbarButtonInternal;
  }
}
export class ExtensionSidebarPane extends UI.View.SimpleView {
  panelNameInternal;
  server;
  idInternal;
  extensionView;
  objectPropertiesView;
  constructor(server, panelName, title, id) {
    super(title);
    this.element.classList.add("fill");
    this.panelNameInternal = panelName;
    this.server = server;
    this.idInternal = id;
  }
  id() {
    return this.idInternal;
  }
  panelName() {
    return this.panelNameInternal;
  }
  setObject(object, title, callback) {
    this.createObjectPropertiesView();
    this.setObjectInternal(SDK.RemoteObject.RemoteObject.fromLocalObject(object), title, callback);
  }
  setExpression(expression, title, evaluateOptions, securityOrigin, callback) {
    this.createObjectPropertiesView();
    this.server.evaluate(expression, true, false, evaluateOptions, securityOrigin, this.onEvaluate.bind(this, title, callback));
  }
  setPage(url) {
    if (this.objectPropertiesView) {
      this.objectPropertiesView.detach();
      delete this.objectPropertiesView;
    }
    if (this.extensionView) {
      this.extensionView.detach(true);
    }
    this.extensionView = new ExtensionView(this.server, this.idInternal, url, "extension fill");
    this.extensionView.show(this.element);
    if (!this.element.style.height) {
      this.setHeight("150px");
    }
  }
  setHeight(height) {
    this.element.style.height = height;
  }
  onEvaluate(title, callback, error, result, _wasThrown) {
    if (error) {
      callback(error.toString());
    } else if (!result) {
      callback();
    } else {
      this.setObjectInternal(result, title, callback);
    }
  }
  createObjectPropertiesView() {
    if (this.objectPropertiesView) {
      return;
    }
    if (this.extensionView) {
      this.extensionView.detach(true);
      delete this.extensionView;
    }
    this.objectPropertiesView = new ExtensionNotifierView(this.server, this.idInternal);
    this.objectPropertiesView.show(this.element);
  }
  setObjectInternal(object, title, callback) {
    const objectPropertiesView = this.objectPropertiesView;
    if (!objectPropertiesView) {
      callback("operation cancelled");
      return;
    }
    objectPropertiesView.element.removeChildren();
    void UI.UIUtils.Renderer.render(object, { title, editable: false }).then((result) => {
      if (!result) {
        callback();
        return;
      }
      const firstChild = result.tree && result.tree.firstChild();
      if (firstChild) {
        firstChild.expand();
      }
      objectPropertiesView.element.appendChild(result.node);
      callback();
    });
  }
}
//# sourceMappingURL=ExtensionPanel.js.map
