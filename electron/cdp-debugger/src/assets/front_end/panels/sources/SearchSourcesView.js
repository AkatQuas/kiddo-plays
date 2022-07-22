import * as UI from "../../ui/legacy/legacy.js";
import * as Search from "../search/search.js";
import { SourcesSearchScope } from "./SourcesSearchScope.js";
let searchSourcesViewInstance;
export class SearchSourcesView extends Search.SearchView.SearchView {
  constructor() {
    super("sources");
  }
  static instance() {
    if (!searchSourcesViewInstance) {
      searchSourcesViewInstance = new SearchSourcesView();
    }
    return searchSourcesViewInstance;
  }
  static async openSearch(query, searchImmediately) {
    const view = UI.ViewManager.ViewManager.instance().view("sources.search-sources-tab");
    const location = await UI.ViewManager.ViewManager.instance().resolveLocation("drawer-view");
    location.appendView(view);
    await UI.ViewManager.ViewManager.instance().revealView(view);
    const widget = await view.widget();
    void widget.toggle(query, Boolean(searchImmediately));
    return widget;
  }
  createScope() {
    return new SourcesSearchScope();
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
  handleAction(_context, _actionId) {
    void this.showSearch();
    return true;
  }
  showSearch() {
    const selection = UI.InspectorView.InspectorView.instance().element.window().getSelection();
    let queryCandidate = "";
    if (selection && selection.rangeCount) {
      queryCandidate = selection.toString().replace(/\r?\n.*/, "");
    }
    return SearchSourcesView.openSearch(queryCandidate);
  }
}
//# sourceMappingURL=SearchSourcesView.js.map
