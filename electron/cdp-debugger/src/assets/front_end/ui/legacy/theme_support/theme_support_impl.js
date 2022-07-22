import * as Common from "../../../core/common/common.js";
import inspectorSyntaxHighlightStyles from "../inspectorSyntaxHighlight.css.legacy.js";
let themeSupportInstance;
const themeValuesCache = /* @__PURE__ */ new Map();
export class ThemeSupport extends EventTarget {
  constructor(setting) {
    super();
    this.setting = setting;
  }
  themeNameInternal = "default";
  customSheets = /* @__PURE__ */ new Set();
  computedRoot = Common.Lazy.lazy(() => window.getComputedStyle(document.documentElement));
  static hasInstance() {
    return typeof themeSupportInstance !== "undefined";
  }
  static instance(opts = { forceNew: null, setting: null }) {
    const { forceNew, setting } = opts;
    if (!themeSupportInstance || forceNew) {
      if (!setting) {
        throw new Error(`Unable to create theme support: setting must be provided: ${new Error().stack}`);
      }
      themeSupportInstance = new ThemeSupport(setting);
    }
    return themeSupportInstance;
  }
  getComputedValue(variableName, target = null) {
    const computedRoot = target ? window.getComputedStyle(target) : this.computedRoot();
    if (typeof computedRoot === "symbol") {
      throw new Error(`Computed value for property (${variableName}) could not be found on :root.`);
    }
    let computedRootCache = themeValuesCache.get(computedRoot);
    if (!computedRootCache) {
      computedRootCache = /* @__PURE__ */ new Map();
      themeValuesCache.set(computedRoot, computedRootCache);
    }
    let cachedValue = computedRootCache.get(variableName);
    if (!cachedValue) {
      cachedValue = computedRoot.getPropertyValue(variableName).trim();
      if (cachedValue) {
        computedRootCache.set(variableName, cachedValue);
      }
    }
    return cachedValue;
  }
  hasTheme() {
    return this.themeNameInternal !== "default";
  }
  themeName() {
    return this.themeNameInternal;
  }
  injectHighlightStyleSheets(element) {
    this.appendStyle(element, inspectorSyntaxHighlightStyles);
  }
  appendStyle(node, { cssContent }) {
    const styleElement = document.createElement("style");
    styleElement.textContent = cssContent;
    node.appendChild(styleElement);
  }
  injectCustomStyleSheets(element) {
    for (const sheet of this.customSheets) {
      const styleElement = document.createElement("style");
      styleElement.textContent = sheet;
      element.appendChild(styleElement);
    }
  }
  addCustomStylesheet(sheetText) {
    this.customSheets.add(sheetText);
  }
  applyTheme(document2) {
    const isForcedColorsMode = window.matchMedia("(forced-colors: active)").matches;
    if (isForcedColorsMode) {
      return;
    }
    const systemPreferredTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default";
    this.themeNameInternal = this.setting.get() === "systemPreferred" ? systemPreferredTheme : this.setting.get();
    const wasDarkThemed = document2.documentElement.classList.contains("-theme-with-dark-background");
    document2.documentElement.classList.toggle("-theme-with-dark-background", this.themeNameInternal === "dark");
    const isDarkThemed = document2.documentElement.classList.contains("-theme-with-dark-background");
    if (wasDarkThemed !== isDarkThemed) {
      themeValuesCache.clear();
      this.customSheets.clear();
      this.dispatchEvent(new ThemeChangeEvent());
    }
  }
}
export class ThemeChangeEvent extends Event {
  static eventName = "themechange";
  constructor() {
    super(ThemeChangeEvent.eventName, { bubbles: true, composed: true });
  }
}
//# sourceMappingURL=theme_support_impl.js.map
