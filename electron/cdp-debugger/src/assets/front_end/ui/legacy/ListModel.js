import * as Common from "../../core/common/common.js";
import * as Platform from "../../core/platform/platform.js";
export class ListModel extends Common.ObjectWrapper.ObjectWrapper {
  items;
  constructor(items) {
    super();
    this.items = items || [];
  }
  [Symbol.iterator]() {
    return this.items[Symbol.iterator]();
  }
  get length() {
    return this.items.length;
  }
  at(index) {
    return this.items[index];
  }
  every(callback) {
    return this.items.every(callback);
  }
  filter(callback) {
    return this.items.filter(callback);
  }
  find(callback) {
    return this.items.find(callback);
  }
  findIndex(callback) {
    return this.items.findIndex(callback);
  }
  indexOf(value, fromIndex) {
    return this.items.indexOf(value, fromIndex);
  }
  insert(index, value) {
    this.items.splice(index, 0, value);
    this.replaced(index, [], 1);
  }
  insertWithComparator(value, comparator) {
    this.insert(Platform.ArrayUtilities.lowerBound(this.items, value, comparator), value);
  }
  join(separator) {
    return this.items.join(separator);
  }
  remove(index) {
    const result = this.items[index];
    this.items.splice(index, 1);
    this.replaced(index, [result], 0);
    return result;
  }
  replace(index, value, keepSelectedIndex) {
    const oldValue = this.items[index];
    this.items[index] = value;
    this.replaced(index, [oldValue], 1, keepSelectedIndex);
    return oldValue;
  }
  replaceRange(from, to, items) {
    let removed;
    if (items.length < 1e4) {
      removed = this.items.splice(from, to - from, ...items);
    } else {
      removed = this.items.slice(from, to);
      const before = this.items.slice(0, from);
      const after = this.items.slice(to);
      this.items = [...before, ...items, ...after];
    }
    this.replaced(from, removed, items.length);
    return removed;
  }
  replaceAll(items) {
    const oldItems = this.items.slice();
    this.items = items;
    this.replaced(0, oldItems, items.length);
    return oldItems;
  }
  slice(from, to) {
    return this.items.slice(from, to);
  }
  some(callback) {
    return this.items.some(callback);
  }
  replaced(index, removed, inserted, keepSelectedIndex) {
    this.dispatchEventToListeners(Events.ItemsReplaced, { index, removed, inserted, keepSelectedIndex });
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["ItemsReplaced"] = "ItemsReplaced";
  return Events2;
})(Events || {});
//# sourceMappingURL=ListModel.js.map
