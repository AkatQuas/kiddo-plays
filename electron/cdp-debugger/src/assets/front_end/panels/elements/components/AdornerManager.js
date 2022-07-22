export var AdornerCategories = /* @__PURE__ */ ((AdornerCategories2) => {
  AdornerCategories2["SECURITY"] = "Security";
  AdornerCategories2["LAYOUT"] = "Layout";
  AdornerCategories2["DEFAULT"] = "Default";
  return AdornerCategories2;
})(AdornerCategories || {});
export var RegisteredAdorners = /* @__PURE__ */ ((RegisteredAdorners2) => {
  RegisteredAdorners2["GRID"] = "grid";
  RegisteredAdorners2["FLEX"] = "flex";
  RegisteredAdorners2["AD"] = "ad";
  RegisteredAdorners2["SCROLL_SNAP"] = "scroll-snap";
  RegisteredAdorners2["CONTAINER"] = "container";
  RegisteredAdorners2["SLOT"] = "slot";
  RegisteredAdorners2["TOP_LAYER"] = "top-layer";
  return RegisteredAdorners2;
})(RegisteredAdorners || {});
export function getRegisteredAdorner(which) {
  switch (which) {
    case "grid" /* GRID */:
      return {
        name: "grid",
        category: "Layout" /* LAYOUT */,
        enabledByDefault: true
      };
    case "flex" /* FLEX */:
      return {
        name: "flex",
        category: "Layout" /* LAYOUT */,
        enabledByDefault: true
      };
    case "ad" /* AD */:
      return {
        name: "ad",
        category: "Security" /* SECURITY */,
        enabledByDefault: true
      };
    case "scroll-snap" /* SCROLL_SNAP */:
      return {
        name: "scroll-snap",
        category: "Layout" /* LAYOUT */,
        enabledByDefault: true
      };
    case "container" /* CONTAINER */:
      return {
        name: "container",
        category: "Layout" /* LAYOUT */,
        enabledByDefault: true
      };
    case "slot" /* SLOT */:
      return {
        name: "slot",
        category: "Layout" /* LAYOUT */,
        enabledByDefault: true
      };
    case "top-layer" /* TOP_LAYER */:
      return {
        name: "top-layer",
        category: "Layout" /* LAYOUT */,
        enabledByDefault: true
      };
  }
}
let adornerNameToCategoryMap = void 0;
function getCategoryFromAdornerName(name) {
  if (!adornerNameToCategoryMap) {
    adornerNameToCategoryMap = /* @__PURE__ */ new Map();
    for (const { name: name2, category } of Object.values(RegisteredAdorners).map(getRegisteredAdorner)) {
      adornerNameToCategoryMap.set(name2, category);
    }
  }
  return adornerNameToCategoryMap.get(name) || "Default" /* DEFAULT */;
}
export const DefaultAdornerSettings = Object.values(RegisteredAdorners).map(getRegisteredAdorner).map(({ name, enabledByDefault }) => ({
  adorner: name,
  isEnabled: enabledByDefault
}));
export class AdornerManager {
  #adornerSettings = /* @__PURE__ */ new Map();
  #settingStore;
  constructor(settingStore) {
    this.#settingStore = settingStore;
    this.#syncSettings();
  }
  updateSettings(settings) {
    this.#adornerSettings = settings;
    this.#persistCurrentSettings();
  }
  getSettings() {
    return this.#adornerSettings;
  }
  isAdornerEnabled(adornerText) {
    return this.#adornerSettings.get(adornerText) || false;
  }
  #persistCurrentSettings() {
    const settingList = [];
    for (const [adorner, isEnabled] of this.#adornerSettings) {
      settingList.push({ adorner, isEnabled });
    }
    this.#settingStore.set(settingList);
  }
  #loadSettings() {
    const settingList = this.#settingStore.get();
    for (const setting of settingList) {
      this.#adornerSettings.set(setting.adorner, setting.isEnabled);
    }
  }
  #syncSettings() {
    this.#loadSettings();
    const outdatedAdorners = new Set(this.#adornerSettings.keys());
    for (const { adorner, isEnabled } of DefaultAdornerSettings) {
      outdatedAdorners.delete(adorner);
      if (!this.#adornerSettings.has(adorner)) {
        this.#adornerSettings.set(adorner, isEnabled);
      }
    }
    for (const outdatedAdorner of outdatedAdorners) {
      this.#adornerSettings.delete(outdatedAdorner);
    }
    this.#persistCurrentSettings();
  }
}
const OrderedAdornerCategories = [
  "Security" /* SECURITY */,
  "Layout" /* LAYOUT */,
  "Default" /* DEFAULT */
];
export const AdornerCategoryOrder = new Map(OrderedAdornerCategories.map((category, idx) => [category, idx + 1]));
export function compareAdornerNamesByCategory(nameA, nameB) {
  const orderA = AdornerCategoryOrder.get(getCategoryFromAdornerName(nameA)) || Number.POSITIVE_INFINITY;
  const orderB = AdornerCategoryOrder.get(getCategoryFromAdornerName(nameB)) || Number.POSITIVE_INFINITY;
  return orderA - orderB;
}
//# sourceMappingURL=AdornerManager.js.map
