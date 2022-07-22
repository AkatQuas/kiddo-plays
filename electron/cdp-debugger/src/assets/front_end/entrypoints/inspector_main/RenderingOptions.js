import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
import renderingOptionsStyles from "./renderingOptions.css.js";
const UIStrings = {
  paintFlashing: "Paint flashing",
  highlightsAreasOfThePageGreen: "Highlights areas of the page (green) that need to be repainted. May not be suitable for people prone to photosensitive epilepsy.",
  layoutShiftRegions: "Layout Shift Regions",
  highlightsAreasOfThePageBlueThat: "Highlights areas of the page (blue) that were shifted. May not be suitable for people prone to photosensitive epilepsy.",
  layerBorders: "Layer borders",
  showsLayerBordersOrangeoliveAnd: "Shows layer borders (orange/olive) and tiles (cyan).",
  frameRenderingStats: "Frame Rendering Stats",
  plotsFrameThroughputDropped: "Plots frame throughput, dropped frames distribution, and GPU memory.",
  scrollingPerformanceIssues: "Scrolling performance issues",
  highlightsElementsTealThatCan: "Highlights elements (teal) that can slow down scrolling, including touch & wheel event handlers and other main-thread scrolling situations.",
  highlightAdFrames: "Highlight ad frames",
  highlightsFramesRedDetectedToBe: "Highlights frames (red) detected to be ads.",
  coreWebVitals: "Core Web Vitals",
  showsAnOverlayWithCoreWebVitals: "Shows an overlay with Core Web Vitals.",
  disableLocalFonts: "Disable local fonts",
  disablesLocalSourcesInFontface: "Disables `local()` sources in `@font-face` rules. Requires a page reload to apply.",
  emulateAFocusedPage: "Emulate a focused page",
  emulatesAFocusedPage: "Emulates a focused page.",
  emulateAutoDarkMode: "Enable automatic dark mode",
  emulatesAutoDarkMode: "Enables automatic dark mode and sets `prefers-color-scheme` to `dark`.",
  forcesMediaTypeForTestingPrint: "Forces media type for testing print and screen styles",
  forcesCssPreferscolorschemeMedia: "Forces CSS `prefers-color-scheme` media feature",
  forcesCssPrefersreducedmotion: "Forces CSS `prefers-reduced-motion` media feature",
  forcesCssPreferscontrastMedia: "Forces CSS `prefers-contrast` media feature",
  forcesCssPrefersreduceddataMedia: "Forces CSS `prefers-reduced-data` media feature",
  forcesCssColorgamutMediaFeature: "Forces CSS `color-gamut` media feature",
  forcesVisionDeficiencyEmulation: "Forces vision deficiency emulation",
  disableAvifImageFormat: "Disable `AVIF` image format",
  disableJpegXlImageFormat: "Disable `JPEG XL` image format",
  requiresAPageReloadToApplyAnd: "Requires a page reload to apply and disables caching for image requests.",
  disableWebpImageFormat: "Disable `WebP` image format",
  forcesCssForcedColors: "Forces CSS forced-colors media feature"
};
const str_ = i18n.i18n.registerUIStrings("entrypoints/inspector_main/RenderingOptions.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const supportsPrefersReducedData = () => {
  const query = "(prefers-reduced-data)";
  return window.matchMedia(query).media === query;
};
const supportsPrefersContrast = () => {
  const query = "(prefers-contrast)";
  return window.matchMedia(query).media === query;
};
const supportsJpegXl = async () => {
  const JPEG_XL_IMAGE_URL = "data:image/jxl;base64,/wr/BwiDBAwASyAY";
  const promise = new Promise((resolve) => {
    const img = document.createElement("img");
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = JPEG_XL_IMAGE_URL;
  });
  return promise;
};
let renderingOptionsViewInstance;
export class RenderingOptionsView extends UI.Widget.VBox {
  constructor() {
    super(true);
    this.#appendCheckbox(i18nString(UIStrings.paintFlashing), i18nString(UIStrings.highlightsAreasOfThePageGreen), Common.Settings.Settings.instance().moduleSetting("showPaintRects"));
    this.#appendCheckbox(i18nString(UIStrings.layoutShiftRegions), i18nString(UIStrings.highlightsAreasOfThePageBlueThat), Common.Settings.Settings.instance().moduleSetting("showLayoutShiftRegions"));
    this.#appendCheckbox(i18nString(UIStrings.layerBorders), i18nString(UIStrings.showsLayerBordersOrangeoliveAnd), Common.Settings.Settings.instance().moduleSetting("showDebugBorders"));
    this.#appendCheckbox(i18nString(UIStrings.frameRenderingStats), i18nString(UIStrings.plotsFrameThroughputDropped), Common.Settings.Settings.instance().moduleSetting("showFPSCounter"));
    this.#appendCheckbox(i18nString(UIStrings.scrollingPerformanceIssues), i18nString(UIStrings.highlightsElementsTealThatCan), Common.Settings.Settings.instance().moduleSetting("showScrollBottleneckRects"));
    this.#appendCheckbox(i18nString(UIStrings.highlightAdFrames), i18nString(UIStrings.highlightsFramesRedDetectedToBe), Common.Settings.Settings.instance().moduleSetting("showAdHighlights"));
    this.#appendCheckbox(i18nString(UIStrings.coreWebVitals), i18nString(UIStrings.showsAnOverlayWithCoreWebVitals), Common.Settings.Settings.instance().moduleSetting("showWebVitals"));
    this.#appendCheckbox(i18nString(UIStrings.disableLocalFonts), i18nString(UIStrings.disablesLocalSourcesInFontface), Common.Settings.Settings.instance().moduleSetting("localFontsDisabled"));
    this.#appendCheckbox(i18nString(UIStrings.emulateAFocusedPage), i18nString(UIStrings.emulatesAFocusedPage), Common.Settings.Settings.instance().moduleSetting("emulatePageFocus"));
    this.#appendCheckbox(i18nString(UIStrings.emulateAutoDarkMode), i18nString(UIStrings.emulatesAutoDarkMode), Common.Settings.Settings.instance().moduleSetting("emulateAutoDarkMode"));
    this.contentElement.createChild("div").classList.add("panel-section-separator");
    this.#appendSelect(i18nString(UIStrings.forcesCssPreferscolorschemeMedia), Common.Settings.Settings.instance().moduleSetting("emulatedCSSMediaFeaturePrefersColorScheme"));
    this.#appendSelect(i18nString(UIStrings.forcesMediaTypeForTestingPrint), Common.Settings.Settings.instance().moduleSetting("emulatedCSSMedia"));
    this.#appendSelect(i18nString(UIStrings.forcesCssForcedColors), Common.Settings.Settings.instance().moduleSetting("emulatedCSSMediaFeatureForcedColors"));
    if (supportsPrefersContrast()) {
      this.#appendSelect(i18nString(UIStrings.forcesCssPreferscontrastMedia), Common.Settings.Settings.instance().moduleSetting("emulatedCSSMediaFeaturePrefersContrast"));
    }
    this.#appendSelect(i18nString(UIStrings.forcesCssPrefersreducedmotion), Common.Settings.Settings.instance().moduleSetting("emulatedCSSMediaFeaturePrefersReducedMotion"));
    if (supportsPrefersReducedData()) {
      this.#appendSelect(i18nString(UIStrings.forcesCssPrefersreduceddataMedia), Common.Settings.Settings.instance().moduleSetting("emulatedCSSMediaFeaturePrefersReducedData"));
    }
    this.#appendSelect(i18nString(UIStrings.forcesCssColorgamutMediaFeature), Common.Settings.Settings.instance().moduleSetting("emulatedCSSMediaFeatureColorGamut"));
    this.contentElement.createChild("div").classList.add("panel-section-separator");
    this.#appendSelect(i18nString(UIStrings.forcesVisionDeficiencyEmulation), Common.Settings.Settings.instance().moduleSetting("emulatedVisionDeficiency"));
    this.contentElement.createChild("div").classList.add("panel-section-separator");
    this.#appendCheckbox(i18nString(UIStrings.disableAvifImageFormat), i18nString(UIStrings.requiresAPageReloadToApplyAnd), Common.Settings.Settings.instance().moduleSetting("avifFormatDisabled"));
    const webpCheckbox = this.#appendCheckbox(i18nString(UIStrings.disableWebpImageFormat), i18nString(UIStrings.requiresAPageReloadToApplyAnd), Common.Settings.Settings.instance().moduleSetting("webpFormatDisabled"));
    this.contentElement.createChild("div").classList.add("panel-section-separator");
    void supportsJpegXl().then((hasSupport) => {
      if (!hasSupport) {
        return;
      }
      webpCheckbox.before(this.#createCheckbox(i18nString(UIStrings.disableJpegXlImageFormat), i18nString(UIStrings.requiresAPageReloadToApplyAnd), Common.Settings.Settings.instance().moduleSetting("jpegXlFormatDisabled")));
    });
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!renderingOptionsViewInstance || forceNew) {
      renderingOptionsViewInstance = new RenderingOptionsView();
    }
    return renderingOptionsViewInstance;
  }
  #createCheckbox(label, subtitle, setting) {
    const checkboxLabel = UI.UIUtils.CheckboxLabel.create(label, false, subtitle);
    UI.SettingsUI.bindCheckbox(checkboxLabel.checkboxElement, setting);
    return checkboxLabel;
  }
  #appendCheckbox(label, subtitle, setting) {
    const checkbox = this.#createCheckbox(label, subtitle, setting);
    this.contentElement.appendChild(checkbox);
    return checkbox;
  }
  #appendSelect(label, setting) {
    const control = UI.SettingsUI.createControlForSetting(setting, label);
    if (control) {
      this.contentElement.appendChild(control);
    }
  }
  wasShown() {
    super.wasShown();
    this.registerCSSFiles([renderingOptionsStyles]);
  }
}
let reloadActionDelegateInstance;
export class ReloadActionDelegate {
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!reloadActionDelegateInstance || forceNew) {
      reloadActionDelegateInstance = new ReloadActionDelegate();
    }
    return reloadActionDelegateInstance;
  }
  handleAction(context, actionId) {
    const emulatedCSSMediaFeaturePrefersColorSchemeSetting = Common.Settings.Settings.instance().moduleSetting("emulatedCSSMediaFeaturePrefersColorScheme");
    switch (actionId) {
      case "rendering.toggle-prefers-color-scheme":
        if (emulatedCSSMediaFeaturePrefersColorSchemeSetting.get() === "light") {
          emulatedCSSMediaFeaturePrefersColorSchemeSetting.set("dark");
        } else {
          emulatedCSSMediaFeaturePrefersColorSchemeSetting.set("light");
        }
        return true;
    }
    return false;
  }
}
//# sourceMappingURL=RenderingOptions.js.map
