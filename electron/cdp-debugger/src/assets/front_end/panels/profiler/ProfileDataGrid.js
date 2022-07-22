import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as DataGrid from "../../ui/legacy/components/data_grid/data_grid.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  notOptimizedS: "Not optimized: {PH1}",
  genericTextTwoPlaceholders: "{PH1}, {PH2}"
};
const str_ = i18n.i18n.registerUIStrings("panels/profiler/ProfileDataGrid.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class ProfileDataGridNode extends DataGrid.DataGrid.DataGridNode {
  searchMatchedSelfColumn;
  searchMatchedTotalColumn;
  searchMatchedFunctionColumn;
  profileNode;
  tree;
  childrenByCallUID;
  lastComparator;
  callUID;
  self;
  total;
  functionName;
  deoptReason;
  url;
  linkElement;
  populated;
  savedSelf;
  savedTotal;
  savedChildren;
  constructor(profileNode, owningTree, hasChildren) {
    super(null, hasChildren);
    this.searchMatchedSelfColumn = false;
    this.searchMatchedTotalColumn = false;
    this.searchMatchedFunctionColumn = false;
    this.profileNode = profileNode;
    this.tree = owningTree;
    this.childrenByCallUID = /* @__PURE__ */ new Map();
    this.lastComparator = null;
    this.callUID = profileNode.callUID;
    this.self = profileNode.self;
    this.total = profileNode.total;
    this.functionName = UI.UIUtils.beautifyFunctionName(profileNode.functionName);
    this.deoptReason = profileNode.deoptReason || "";
    this.url = profileNode.url;
    this.linkElement = null;
    this.populated = false;
  }
  static sort(gridNodeGroups, comparator, force) {
    for (let gridNodeGroupIndex = 0; gridNodeGroupIndex < gridNodeGroups.length; ++gridNodeGroupIndex) {
      const gridNodes = gridNodeGroups[gridNodeGroupIndex];
      const count = gridNodes.length;
      for (let index = 0; index < count; ++index) {
        const gridNode = gridNodes[index];
        if (!force && (!gridNode.expanded || gridNode.lastComparator === comparator)) {
          if (gridNode.children.length) {
            gridNode.shouldRefreshChildren = true;
          }
          continue;
        }
        gridNode.lastComparator = comparator;
        const children = gridNode.children;
        const childCount = children.length;
        if (childCount) {
          children.sort(comparator);
          for (let childIndex = 0; childIndex < childCount; ++childIndex) {
            children[childIndex].recalculateSiblings(childIndex);
          }
          gridNodeGroups.push(children);
        }
      }
    }
  }
  static merge(container, child, shouldAbsorb) {
    container.self += child.self;
    if (!shouldAbsorb) {
      container.total += child.total;
    }
    let children = container.children.slice();
    container.removeChildren();
    let count = children.length;
    for (let index = 0; index < count; ++index) {
      if (!shouldAbsorb || children[index] !== child) {
        container.appendChild(children[index]);
      }
    }
    children = child.children.slice();
    count = children.length;
    for (let index = 0; index < count; ++index) {
      const orphanedChild = children[index];
      const existingChild = container.childrenByCallUID.get(orphanedChild.callUID);
      if (existingChild) {
        existingChild.merge(orphanedChild, false);
      } else {
        container.appendChild(orphanedChild);
      }
    }
  }
  static populate(container) {
    if (container.populated) {
      return;
    }
    container.populated = true;
    container.populateChildren();
    const currentComparator = container.tree.lastComparator;
    if (currentComparator) {
      container.sort(currentComparator, true);
    }
  }
  createCell(columnId) {
    switch (columnId) {
      case "self": {
        const cell = this.createValueCell(this.self, this.selfPercent, columnId);
        cell.classList.toggle("highlight", this.searchMatchedSelfColumn);
        return cell;
      }
      case "total": {
        const cell = this.createValueCell(this.total, this.totalPercent, columnId);
        cell.classList.toggle("highlight", this.searchMatchedTotalColumn);
        return cell;
      }
      case "function": {
        const cell = this.createTD(columnId);
        cell.classList.toggle("highlight", this.searchMatchedFunctionColumn);
        if (this.deoptReason) {
          cell.classList.add("not-optimized");
          const warningIcon = UI.Icon.Icon.create("smallicon-warning", "profile-warn-marker");
          UI.Tooltip.Tooltip.install(warningIcon, i18nString(UIStrings.notOptimizedS, { PH1: this.deoptReason }));
          cell.appendChild(warningIcon);
        }
        UI.UIUtils.createTextChild(cell, this.functionName);
        if (this.profileNode.scriptId === "0") {
          return cell;
        }
        const urlElement = this.tree.formatter.linkifyNode(this);
        if (!urlElement) {
          return cell;
        }
        urlElement.style.maxWidth = "75%";
        cell.appendChild(urlElement);
        this.linkElement = urlElement;
        return cell;
      }
    }
    return super.createCell(columnId);
  }
  createValueCell(value, percent, columnId) {
    const cell = document.createElement("td");
    cell.classList.add("numeric-column");
    const div = cell.createChild("div", "profile-multiple-values");
    const valueSpan = div.createChild("span");
    const valueText = this.tree.formatter.formatValue(value, this);
    valueSpan.textContent = valueText;
    const percentSpan = div.createChild("span", "percent-column");
    const percentText = this.tree.formatter.formatPercent(percent, this);
    percentSpan.textContent = percentText;
    const valueAccessibleText = this.tree.formatter.formatValueAccessibleText(value, this);
    this.setCellAccessibleName(i18nString(UIStrings.genericTextTwoPlaceholders, { PH1: valueAccessibleText, PH2: percentText }), cell, columnId);
    return cell;
  }
  sort(comparator, force) {
    const sortComparator = comparator;
    return ProfileDataGridNode.sort([[this]], sortComparator, force);
  }
  insertChild(child, index) {
    const profileDataGridNode = child;
    super.insertChild(profileDataGridNode, index);
    this.childrenByCallUID.set(profileDataGridNode.callUID, profileDataGridNode);
  }
  removeChild(profileDataGridNode) {
    super.removeChild(profileDataGridNode);
    this.childrenByCallUID.delete(profileDataGridNode.callUID);
  }
  removeChildren() {
    super.removeChildren();
    this.childrenByCallUID.clear();
  }
  findChild(node) {
    if (!node) {
      return null;
    }
    return this.childrenByCallUID.get(node.callUID) || null;
  }
  get selfPercent() {
    return this.self / this.tree.total * 100;
  }
  get totalPercent() {
    return this.total / this.tree.total * 100;
  }
  populate() {
    ProfileDataGridNode.populate(this);
  }
  populateChildren() {
  }
  save() {
    if (this.savedChildren) {
      return;
    }
    this.savedSelf = this.self;
    this.savedTotal = this.total;
    this.savedChildren = this.children.slice();
  }
  restore() {
    if (!this.savedChildren) {
      return;
    }
    if (this.savedSelf && this.savedTotal) {
      this.self = this.savedSelf;
      this.total = this.savedTotal;
    }
    this.removeChildren();
    const children = this.savedChildren;
    const count = children.length;
    for (let index = 0; index < count; ++index) {
      children[index].restore();
      this.appendChild(children[index]);
    }
  }
  merge(child, shouldAbsorb) {
    ProfileDataGridNode.merge(this, child, shouldAbsorb);
  }
}
export class ProfileDataGridTree {
  tree;
  self;
  children;
  formatter;
  searchableView;
  total;
  lastComparator;
  childrenByCallUID;
  deepSearch;
  populated;
  searchResults;
  savedTotal;
  savedChildren;
  searchResultIndex = -1;
  constructor(formatter, searchableView, total) {
    this.tree = this;
    this.self = 0;
    this.children = [];
    this.formatter = formatter;
    this.searchableView = searchableView;
    this.total = total;
    this.lastComparator = null;
    this.childrenByCallUID = /* @__PURE__ */ new Map();
    this.deepSearch = true;
    this.populated = false;
  }
  static propertyComparator(property, isAscending) {
    let comparator = ProfileDataGridTree.propertyComparators[isAscending ? 1 : 0][property];
    if (!comparator) {
      if (isAscending) {
        comparator = function(lhs, rhs) {
          if (lhs[property] < rhs[property]) {
            return -1;
          }
          if (lhs[property] > rhs[property]) {
            return 1;
          }
          return 0;
        };
      } else {
        comparator = function(lhs, rhs) {
          if (lhs[property] > rhs[property]) {
            return -1;
          }
          if (lhs[property] < rhs[property]) {
            return 1;
          }
          return 0;
        };
      }
      ProfileDataGridTree.propertyComparators[isAscending ? 1 : 0][property] = comparator;
    }
    return comparator;
  }
  get expanded() {
    return true;
  }
  appendChild(child) {
    this.insertChild(child, this.children.length);
  }
  focus(_profileDataGridNode) {
  }
  exclude(_profileDataGridNode) {
  }
  insertChild(child, index) {
    const childToInsert = child;
    this.children.splice(index, 0, childToInsert);
    this.childrenByCallUID.set(childToInsert.callUID, child);
  }
  removeChildren() {
    this.children = [];
    this.childrenByCallUID.clear();
  }
  populateChildren() {
  }
  findChild(node) {
    if (!node) {
      return null;
    }
    return this.childrenByCallUID.get(node.callUID) || null;
  }
  sort(comparator, force) {
    return ProfileDataGridNode.sort([[this]], comparator, force);
  }
  save() {
    if (this.savedChildren) {
      return;
    }
    this.savedTotal = this.total;
    this.savedChildren = this.children.slice();
  }
  restore() {
    if (!this.savedChildren) {
      return;
    }
    this.children = this.savedChildren;
    if (this.savedTotal) {
      this.total = this.savedTotal;
    }
    const children = this.children;
    const count = children.length;
    for (let index = 0; index < count; ++index) {
      children[index].restore();
    }
    this.savedChildren = null;
  }
  matchFunction(searchConfig) {
    const query = searchConfig.query.trim();
    if (!query.length) {
      return null;
    }
    const greaterThan = query.startsWith(">");
    const lessThan = query.startsWith("<");
    let equalTo = query.startsWith("=") || (greaterThan || lessThan) && query.indexOf("=") === 1;
    const percentUnits = query.endsWith("%");
    const millisecondsUnits = query.length > 2 && query.endsWith("ms");
    const secondsUnits = !millisecondsUnits && query.endsWith("s");
    let queryNumber = parseFloat(query);
    if (greaterThan || lessThan || equalTo) {
      if (equalTo && (greaterThan || lessThan)) {
        queryNumber = parseFloat(query.substring(2));
      } else {
        queryNumber = parseFloat(query.substring(1));
      }
    }
    const queryNumberMilliseconds = secondsUnits ? queryNumber * 1e3 : queryNumber;
    if (!isNaN(queryNumber) && !(greaterThan || lessThan)) {
      equalTo = true;
    }
    const matcher = Platform.StringUtilities.createPlainTextSearchRegex(query, "i");
    function matchesQuery(profileDataGridNode) {
      profileDataGridNode.searchMatchedSelfColumn = false;
      profileDataGridNode.searchMatchedTotalColumn = false;
      profileDataGridNode.searchMatchedFunctionColumn = false;
      if (percentUnits) {
        if (lessThan) {
          if (profileDataGridNode.selfPercent < queryNumber) {
            profileDataGridNode.searchMatchedSelfColumn = true;
          }
          if (profileDataGridNode.totalPercent < queryNumber) {
            profileDataGridNode.searchMatchedTotalColumn = true;
          }
        } else if (greaterThan) {
          if (profileDataGridNode.selfPercent > queryNumber) {
            profileDataGridNode.searchMatchedSelfColumn = true;
          }
          if (profileDataGridNode.totalPercent > queryNumber) {
            profileDataGridNode.searchMatchedTotalColumn = true;
          }
        }
        if (equalTo) {
          if (profileDataGridNode.selfPercent === queryNumber) {
            profileDataGridNode.searchMatchedSelfColumn = true;
          }
          if (profileDataGridNode.totalPercent === queryNumber) {
            profileDataGridNode.searchMatchedTotalColumn = true;
          }
        }
      } else if (millisecondsUnits || secondsUnits) {
        if (lessThan) {
          if (profileDataGridNode.self < queryNumberMilliseconds) {
            profileDataGridNode.searchMatchedSelfColumn = true;
          }
          if (profileDataGridNode.total < queryNumberMilliseconds) {
            profileDataGridNode.searchMatchedTotalColumn = true;
          }
        } else if (greaterThan) {
          if (profileDataGridNode.self > queryNumberMilliseconds) {
            profileDataGridNode.searchMatchedSelfColumn = true;
          }
          if (profileDataGridNode.total > queryNumberMilliseconds) {
            profileDataGridNode.searchMatchedTotalColumn = true;
          }
        }
        if (equalTo) {
          if (profileDataGridNode.self === queryNumberMilliseconds) {
            profileDataGridNode.searchMatchedSelfColumn = true;
          }
          if (profileDataGridNode.total === queryNumberMilliseconds) {
            profileDataGridNode.searchMatchedTotalColumn = true;
          }
        }
      }
      if (profileDataGridNode.functionName.match(matcher) || profileDataGridNode.url && profileDataGridNode.url.match(matcher)) {
        profileDataGridNode.searchMatchedFunctionColumn = true;
      }
      if (profileDataGridNode.searchMatchedSelfColumn || profileDataGridNode.searchMatchedTotalColumn || profileDataGridNode.searchMatchedFunctionColumn) {
        profileDataGridNode.refresh();
        return true;
      }
      return false;
    }
    return matchesQuery;
  }
  performSearch(searchConfig, shouldJump, jumpBackwards) {
    this.searchCanceled();
    const matchesQuery = this.matchFunction(searchConfig);
    if (!matchesQuery) {
      return;
    }
    this.searchResults = [];
    const deepSearch = this.deepSearch;
    let current;
    for (current = this.children[0]; current; current = current.traverseNextNode(!deepSearch, null, !deepSearch)) {
      const item = current;
      if (!item) {
        break;
      }
      if (matchesQuery(item)) {
        this.searchResults.push({ profileNode: item });
      }
    }
    this.searchResultIndex = jumpBackwards ? 0 : this.searchResults.length - 1;
    this.searchableView.updateSearchMatchesCount(this.searchResults.length);
    this.searchableView.updateCurrentMatchIndex(this.searchResultIndex);
  }
  searchCanceled() {
    if (this.searchResults) {
      for (let i = 0; i < this.searchResults.length; ++i) {
        const profileNode = this.searchResults[i].profileNode;
        profileNode.searchMatchedSelfColumn = false;
        profileNode.searchMatchedTotalColumn = false;
        profileNode.searchMatchedFunctionColumn = false;
        profileNode.refresh();
      }
    }
    this.searchResults = [];
    this.searchResultIndex = -1;
  }
  jumpToNextSearchResult() {
    if (!this.searchResults || !this.searchResults.length) {
      return;
    }
    this.searchResultIndex = (this.searchResultIndex + 1) % this.searchResults.length;
    this.jumpToSearchResult(this.searchResultIndex);
  }
  jumpToPreviousSearchResult() {
    if (!this.searchResults || !this.searchResults.length) {
      return;
    }
    this.searchResultIndex = (this.searchResultIndex - 1 + this.searchResults.length) % this.searchResults.length;
    this.jumpToSearchResult(this.searchResultIndex);
  }
  supportsCaseSensitiveSearch() {
    return true;
  }
  supportsRegexSearch() {
    return false;
  }
  jumpToSearchResult(index) {
    const searchResult = this.searchResults[index];
    if (!searchResult) {
      return;
    }
    const profileNode = searchResult.profileNode;
    profileNode.revealAndSelect();
    this.searchableView.updateCurrentMatchIndex(index);
  }
  static propertyComparators = [{}, {}];
}
//# sourceMappingURL=ProfileDataGrid.js.map
