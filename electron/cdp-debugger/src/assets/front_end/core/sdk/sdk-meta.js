import * as Common from "../common/common.js";
import * as i18n from "../i18n/i18n.js";
const UIStrings = {
  preserveLogUponNavigation: "Preserve log upon navigation",
  doNotPreserveLogUponNavigation: "Do not preserve log upon navigation",
  pauseOnExceptions: "Pause on exceptions",
  doNotPauseOnExceptions: "Do not pause on exceptions",
  disableJavascript: "Disable JavaScript",
  enableJavascript: "Enable JavaScript",
  disableAsyncStackTraces: "Disable async stack traces",
  doNotCaptureAsyncStackTraces: "Do not capture async stack traces",
  captureAsyncStackTraces: "Capture async stack traces",
  showRulersOnHover: "Show rulers on hover",
  doNotShowRulersOnHover: "Do not show rulers on hover",
  showAreaNames: "Show area names",
  showGridNamedAreas: "Show grid named areas",
  doNotShowGridNamedAreas: "Do not show grid named areas",
  showTrackSizes: "Show track sizes",
  showGridTrackSizes: "Show grid track sizes",
  doNotShowGridTrackSizes: "Do not show grid track sizes",
  extendGridLines: "Extend grid lines",
  doNotExtendGridLines: "Do not extend grid lines",
  showLineLabels: "Show line labels",
  hideLineLabels: "Hide line labels",
  showLineNumbers: "Show line numbers",
  showLineNames: "Show line names",
  showPaintFlashingRectangles: "Show paint flashing rectangles",
  hidePaintFlashingRectangles: "Hide paint flashing rectangles",
  showLayoutShiftRegions: "Show layout shift regions",
  hideLayoutShiftRegions: "Hide layout shift regions",
  highlightAdFrames: "Highlight ad frames",
  doNotHighlightAdFrames: "Do not highlight ad frames",
  showLayerBorders: "Show layer borders",
  hideLayerBorders: "Hide layer borders",
  showCoreWebVitalsOverlay: "Show Core Web Vitals overlay",
  hideCoreWebVitalsOverlay: "Hide Core Web Vitals overlay",
  showFramesPerSecondFpsMeter: "Show frames per second (FPS) meter",
  hideFramesPerSecondFpsMeter: "Hide frames per second (FPS) meter",
  showScrollPerformanceBottlenecks: "Show scroll performance bottlenecks",
  hideScrollPerformanceBottlenecks: "Hide scroll performance bottlenecks",
  emulateAFocusedPage: "Emulate a focused page",
  doNotEmulateAFocusedPage: "Do not emulate a focused page",
  doNotEmulateCssMediaType: "Do not emulate CSS media type",
  noEmulation: "No emulation",
  emulateCssPrintMediaType: "Emulate CSS print media type",
  print: "print",
  emulateCssScreenMediaType: "Emulate CSS screen media type",
  screen: "screen",
  query: "query",
  emulateCssMediaType: "Emulate CSS media type",
  doNotEmulateCss: "Do not emulate CSS {PH1}",
  emulateCss: "Emulate CSS {PH1}",
  emulateCssMediaFeature: "Emulate CSS media feature {PH1}",
  doNotEmulateAnyVisionDeficiency: "Do not emulate any vision deficiency",
  emulateBlurredVision: "Emulate blurred vision",
  blurredVision: "Blurred vision",
  emulateProtanopia: "Emulate protanopia",
  protanopia: "Protanopia",
  emulateDeuteranopia: "Emulate deuteranopia",
  deuteranopia: "Deuteranopia",
  emulateTritanopia: "Emulate tritanopia",
  tritanopia: "Tritanopia",
  emulateAchromatopsia: "Emulate achromatopsia",
  achromatopsia: "Achromatopsia",
  emulateVisionDeficiencies: "Emulate vision deficiencies",
  disableLocalFonts: "Disable local fonts",
  enableLocalFonts: "Enable local fonts",
  disableAvifFormat: "Disable `AVIF` format",
  enableAvifFormat: "Enable `AVIF` format",
  disableJpegXlFormat: "Disable `JPEG XL` format",
  enableJpegXlFormat: "Enable `JPEG XL` format",
  disableWebpFormat: "Disable `WebP` format",
  enableWebpFormat: "Enable `WebP` format",
  enableCustomFormatters: "Enable custom formatters",
  enableNetworkRequestBlocking: "Enable network request blocking",
  disableNetworkRequestBlocking: "Disable network request blocking",
  enableCache: "Enable cache",
  disableCache: "Disable cache (while DevTools is open)",
  emulateAutoDarkMode: "Emulate auto dark mode"
};
const str_ = i18n.i18n.registerUIStrings("core/sdk/sdk-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
Common.Settings.registerSettingExtension({
  storageType: Common.Settings.SettingStorageType.Synced,
  settingName: "skipStackFramesPattern",
  settingType: Common.Settings.SettingType.REGEX,
  defaultValue: ""
});
Common.Settings.registerSettingExtension({
  storageType: Common.Settings.SettingStorageType.Synced,
  settingName: "skipContentScripts",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.CONSOLE,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.preserveLogUponNavigation),
  settingName: "preserveConsoleLog",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.preserveLogUponNavigation)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.doNotPreserveLogUponNavigation)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.DEBUGGER,
  settingName: "pauseOnExceptionEnabled",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.pauseOnExceptions)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.doNotPauseOnExceptions)
    }
  ]
});
Common.Settings.registerSettingExtension({
  settingName: "pauseOnCaughtException",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.DEBUGGER,
  title: i18nLazyString(UIStrings.disableJavascript),
  settingName: "javaScriptDisabled",
  settingType: Common.Settings.SettingType.BOOLEAN,
  storageType: Common.Settings.SettingStorageType.Session,
  order: 1,
  defaultValue: false,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.disableJavascript)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.enableJavascript)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.DEBUGGER,
  title: i18nLazyString(UIStrings.disableAsyncStackTraces),
  settingName: "disableAsyncStackTraces",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false,
  order: 2,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.doNotCaptureAsyncStackTraces)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.captureAsyncStackTraces)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.DEBUGGER,
  settingName: "breakpointsActive",
  settingType: Common.Settings.SettingType.BOOLEAN,
  storageType: Common.Settings.SettingStorageType.Session,
  defaultValue: true
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.ELEMENTS,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.showRulersOnHover),
  settingName: "showMetricsRulers",
  settingType: Common.Settings.SettingType.BOOLEAN,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.showRulersOnHover)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.doNotShowRulersOnHover)
    }
  ],
  defaultValue: false
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.GRID,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.showAreaNames),
  settingName: "showGridAreas",
  settingType: Common.Settings.SettingType.BOOLEAN,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.showGridNamedAreas)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.doNotShowGridNamedAreas)
    }
  ],
  defaultValue: false
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.GRID,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.showTrackSizes),
  settingName: "showGridTrackSizes",
  settingType: Common.Settings.SettingType.BOOLEAN,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.showGridTrackSizes)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.doNotShowGridTrackSizes)
    }
  ],
  defaultValue: false
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.GRID,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.extendGridLines),
  settingName: "extendGridLines",
  settingType: Common.Settings.SettingType.BOOLEAN,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.extendGridLines)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.doNotExtendGridLines)
    }
  ],
  defaultValue: false
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.GRID,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.showLineLabels),
  settingName: "showGridLineLabels",
  settingType: Common.Settings.SettingType.ENUM,
  options: [
    {
      title: i18nLazyString(UIStrings.hideLineLabels),
      text: i18nLazyString(UIStrings.hideLineLabels),
      value: "none"
    },
    {
      title: i18nLazyString(UIStrings.showLineNumbers),
      text: i18nLazyString(UIStrings.showLineNumbers),
      value: "lineNumbers"
    },
    {
      title: i18nLazyString(UIStrings.showLineNames),
      text: i18nLazyString(UIStrings.showLineNames),
      value: "lineNames"
    }
  ],
  defaultValue: "lineNumbers"
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.RENDERING,
  settingName: "showPaintRects",
  settingType: Common.Settings.SettingType.BOOLEAN,
  storageType: Common.Settings.SettingStorageType.Session,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.showPaintFlashingRectangles)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.hidePaintFlashingRectangles)
    }
  ],
  defaultValue: false
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.RENDERING,
  settingName: "showLayoutShiftRegions",
  settingType: Common.Settings.SettingType.BOOLEAN,
  storageType: Common.Settings.SettingStorageType.Session,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.showLayoutShiftRegions)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.hideLayoutShiftRegions)
    }
  ],
  defaultValue: false
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.RENDERING,
  settingName: "showAdHighlights",
  settingType: Common.Settings.SettingType.BOOLEAN,
  storageType: Common.Settings.SettingStorageType.Session,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.highlightAdFrames)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.doNotHighlightAdFrames)
    }
  ],
  defaultValue: false
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.RENDERING,
  settingName: "showDebugBorders",
  settingType: Common.Settings.SettingType.BOOLEAN,
  storageType: Common.Settings.SettingStorageType.Session,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.showLayerBorders)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.hideLayerBorders)
    }
  ],
  defaultValue: false
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.RENDERING,
  settingName: "showWebVitals",
  settingType: Common.Settings.SettingType.BOOLEAN,
  storageType: Common.Settings.SettingStorageType.Session,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.showCoreWebVitalsOverlay)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.hideCoreWebVitalsOverlay)
    }
  ],
  defaultValue: false
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.RENDERING,
  settingName: "showFPSCounter",
  settingType: Common.Settings.SettingType.BOOLEAN,
  storageType: Common.Settings.SettingStorageType.Session,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.showFramesPerSecondFpsMeter)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.hideFramesPerSecondFpsMeter)
    }
  ],
  defaultValue: false
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.RENDERING,
  settingName: "showScrollBottleneckRects",
  settingType: Common.Settings.SettingType.BOOLEAN,
  storageType: Common.Settings.SettingStorageType.Session,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.showScrollPerformanceBottlenecks)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.hideScrollPerformanceBottlenecks)
    }
  ],
  defaultValue: false
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.RENDERING,
  title: i18nLazyString(UIStrings.emulateAFocusedPage),
  settingName: "emulatePageFocus",
  settingType: Common.Settings.SettingType.BOOLEAN,
  storageType: Common.Settings.SettingStorageType.Session,
  defaultValue: false,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.emulateAFocusedPage)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.doNotEmulateAFocusedPage)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.RENDERING,
  settingName: "emulatedCSSMedia",
  settingType: Common.Settings.SettingType.ENUM,
  storageType: Common.Settings.SettingStorageType.Session,
  defaultValue: "",
  options: [
    {
      title: i18nLazyString(UIStrings.doNotEmulateCssMediaType),
      text: i18nLazyString(UIStrings.noEmulation),
      value: ""
    },
    {
      title: i18nLazyString(UIStrings.emulateCssPrintMediaType),
      text: i18nLazyString(UIStrings.print),
      value: "print"
    },
    {
      title: i18nLazyString(UIStrings.emulateCssScreenMediaType),
      text: i18nLazyString(UIStrings.screen),
      value: "screen"
    }
  ],
  tags: [
    i18nLazyString(UIStrings.query)
  ],
  title: i18nLazyString(UIStrings.emulateCssMediaType)
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.RENDERING,
  settingName: "emulatedCSSMediaFeaturePrefersColorScheme",
  settingType: Common.Settings.SettingType.ENUM,
  storageType: Common.Settings.SettingStorageType.Session,
  defaultValue: "",
  options: [
    {
      title: i18nLazyString(UIStrings.doNotEmulateCss, { PH1: "prefers-color-scheme" }),
      text: i18nLazyString(UIStrings.noEmulation),
      value: ""
    },
    {
      title: i18nLazyString(UIStrings.emulateCss, { PH1: "prefers-color-scheme: light" }),
      text: i18n.i18n.lockedLazyString("prefers-color-scheme: light"),
      value: "light"
    },
    {
      title: i18nLazyString(UIStrings.emulateCss, { PH1: "prefers-color-scheme: dark" }),
      text: i18n.i18n.lockedLazyString("prefers-color-scheme: dark"),
      value: "dark"
    }
  ],
  tags: [
    i18nLazyString(UIStrings.query)
  ],
  title: i18nLazyString(UIStrings.emulateCssMediaFeature, { PH1: "prefers-color-scheme" })
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.RENDERING,
  settingName: "emulatedCSSMediaFeatureForcedColors",
  settingType: Common.Settings.SettingType.ENUM,
  storageType: Common.Settings.SettingStorageType.Session,
  defaultValue: "",
  options: [
    {
      title: i18nLazyString(UIStrings.doNotEmulateCss, { PH1: "forced-colors" }),
      text: i18nLazyString(UIStrings.noEmulation),
      value: ""
    },
    {
      title: i18nLazyString(UIStrings.emulateCss, { PH1: "forced-colors: active" }),
      text: i18n.i18n.lockedLazyString("forced-colors: active"),
      value: "active"
    },
    {
      title: i18nLazyString(UIStrings.emulateCss, { PH1: "forced-colors: none" }),
      text: i18n.i18n.lockedLazyString("forced-colors: none"),
      value: "none"
    }
  ],
  tags: [
    i18nLazyString(UIStrings.query)
  ],
  title: i18nLazyString(UIStrings.emulateCssMediaFeature, { PH1: "forced-colors" })
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.RENDERING,
  settingName: "emulatedCSSMediaFeaturePrefersReducedMotion",
  settingType: Common.Settings.SettingType.ENUM,
  storageType: Common.Settings.SettingStorageType.Session,
  defaultValue: "",
  options: [
    {
      title: i18nLazyString(UIStrings.doNotEmulateCss, { PH1: "prefers-reduced-motion" }),
      text: i18nLazyString(UIStrings.noEmulation),
      value: ""
    },
    {
      title: i18nLazyString(UIStrings.emulateCss, { PH1: "prefers-reduced-motion: reduce" }),
      text: i18n.i18n.lockedLazyString("prefers-reduced-motion: reduce"),
      value: "reduce"
    }
  ],
  tags: [
    i18nLazyString(UIStrings.query)
  ],
  title: i18nLazyString(UIStrings.emulateCssMediaFeature, { PH1: "prefers-reduced-motion" })
});
Common.Settings.registerSettingExtension({
  settingName: "emulatedCSSMediaFeaturePrefersContrast",
  settingType: Common.Settings.SettingType.ENUM,
  storageType: Common.Settings.SettingStorageType.Session,
  defaultValue: "",
  options: [
    {
      title: i18nLazyString(UIStrings.doNotEmulateCss, { PH1: "prefers-contrast" }),
      text: i18nLazyString(UIStrings.noEmulation),
      value: ""
    },
    {
      title: i18nLazyString(UIStrings.emulateCss, { PH1: "prefers-contrast: more" }),
      text: i18n.i18n.lockedLazyString("prefers-contrast: more"),
      value: "more"
    },
    {
      title: i18nLazyString(UIStrings.emulateCss, { PH1: "prefers-contrast: less" }),
      text: i18n.i18n.lockedLazyString("prefers-contrast: less"),
      value: "less"
    },
    {
      title: i18nLazyString(UIStrings.emulateCss, { PH1: "prefers-contrast: custom" }),
      text: i18n.i18n.lockedLazyString("prefers-contrast: custom"),
      value: "custom"
    }
  ],
  tags: [
    i18nLazyString(UIStrings.query)
  ],
  title: i18nLazyString(UIStrings.emulateCssMediaFeature, { PH1: "prefers-contrast" })
});
Common.Settings.registerSettingExtension({
  settingName: "emulatedCSSMediaFeaturePrefersReducedData",
  settingType: Common.Settings.SettingType.ENUM,
  storageType: Common.Settings.SettingStorageType.Session,
  defaultValue: "",
  options: [
    {
      title: i18nLazyString(UIStrings.doNotEmulateCss, { PH1: "prefers-reduced-data" }),
      text: i18nLazyString(UIStrings.noEmulation),
      value: ""
    },
    {
      title: i18nLazyString(UIStrings.emulateCss, { PH1: "prefers-reduced-data: reduce" }),
      text: i18n.i18n.lockedLazyString("prefers-reduced-data: reduce"),
      value: "reduce"
    }
  ],
  title: i18nLazyString(UIStrings.emulateCssMediaFeature, { PH1: "prefers-reduced-data" })
});
Common.Settings.registerSettingExtension({
  settingName: "emulatedCSSMediaFeatureColorGamut",
  settingType: Common.Settings.SettingType.ENUM,
  storageType: Common.Settings.SettingStorageType.Session,
  defaultValue: "",
  options: [
    {
      title: i18nLazyString(UIStrings.doNotEmulateCss, { PH1: "color-gamut" }),
      text: i18nLazyString(UIStrings.noEmulation),
      value: ""
    },
    {
      title: i18nLazyString(UIStrings.emulateCss, { PH1: "color-gamut: srgb" }),
      text: i18n.i18n.lockedLazyString("color-gamut: srgb"),
      value: "srgb"
    },
    {
      title: i18nLazyString(UIStrings.emulateCss, { PH1: "color-gamut: p3" }),
      text: i18n.i18n.lockedLazyString("color-gamut: p3"),
      value: "p3"
    },
    {
      title: i18nLazyString(UIStrings.emulateCss, { PH1: "color-gamut: rec2020" }),
      text: i18n.i18n.lockedLazyString("color-gamut: rec2020"),
      value: "rec2020"
    }
  ],
  title: i18nLazyString(UIStrings.emulateCssMediaFeature, { PH1: "color-gamut" })
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.RENDERING,
  settingName: "emulatedVisionDeficiency",
  settingType: Common.Settings.SettingType.ENUM,
  storageType: Common.Settings.SettingStorageType.Session,
  defaultValue: "none",
  options: [
    {
      title: i18nLazyString(UIStrings.doNotEmulateAnyVisionDeficiency),
      text: i18nLazyString(UIStrings.noEmulation),
      value: "none"
    },
    {
      title: i18nLazyString(UIStrings.emulateBlurredVision),
      text: i18nLazyString(UIStrings.blurredVision),
      value: "blurredVision"
    },
    {
      title: i18nLazyString(UIStrings.emulateProtanopia),
      text: i18nLazyString(UIStrings.protanopia),
      value: "protanopia"
    },
    {
      title: i18nLazyString(UIStrings.emulateDeuteranopia),
      text: i18nLazyString(UIStrings.deuteranopia),
      value: "deuteranopia"
    },
    {
      title: i18nLazyString(UIStrings.emulateTritanopia),
      text: i18nLazyString(UIStrings.tritanopia),
      value: "tritanopia"
    },
    {
      title: i18nLazyString(UIStrings.emulateAchromatopsia),
      text: i18nLazyString(UIStrings.achromatopsia),
      value: "achromatopsia"
    }
  ],
  tags: [
    i18nLazyString(UIStrings.query)
  ],
  title: i18nLazyString(UIStrings.emulateVisionDeficiencies)
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.RENDERING,
  settingName: "localFontsDisabled",
  settingType: Common.Settings.SettingType.BOOLEAN,
  storageType: Common.Settings.SettingStorageType.Session,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.disableLocalFonts)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.enableLocalFonts)
    }
  ],
  defaultValue: false
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.RENDERING,
  settingName: "avifFormatDisabled",
  settingType: Common.Settings.SettingType.BOOLEAN,
  storageType: Common.Settings.SettingStorageType.Session,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.disableAvifFormat)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.enableAvifFormat)
    }
  ],
  defaultValue: false
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.RENDERING,
  settingName: "jpegXlFormatDisabled",
  settingType: Common.Settings.SettingType.BOOLEAN,
  storageType: Common.Settings.SettingStorageType.Session,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.disableJpegXlFormat)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.enableJpegXlFormat)
    }
  ],
  defaultValue: false
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.RENDERING,
  settingName: "webpFormatDisabled",
  settingType: Common.Settings.SettingType.BOOLEAN,
  storageType: Common.Settings.SettingStorageType.Session,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.disableWebpFormat)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.enableWebpFormat)
    }
  ],
  defaultValue: false
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.CONSOLE,
  title: i18nLazyString(UIStrings.enableCustomFormatters),
  settingName: "customFormatters",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.NETWORK,
  title: i18nLazyString(UIStrings.enableNetworkRequestBlocking),
  settingName: "requestBlockingEnabled",
  settingType: Common.Settings.SettingType.BOOLEAN,
  storageType: Common.Settings.SettingStorageType.Session,
  defaultValue: false,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.enableNetworkRequestBlocking)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.disableNetworkRequestBlocking)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.NETWORK,
  title: i18nLazyString(UIStrings.disableCache),
  settingName: "cacheDisabled",
  settingType: Common.Settings.SettingType.BOOLEAN,
  order: 0,
  defaultValue: false,
  userActionCondition: "hasOtherClients",
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.disableCache)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.enableCache)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.RENDERING,
  title: i18nLazyString(UIStrings.emulateAutoDarkMode),
  settingName: "emulateAutoDarkMode",
  settingType: Common.Settings.SettingType.BOOLEAN,
  storageType: Common.Settings.SettingStorageType.Session,
  defaultValue: false
});
//# sourceMappingURL=sdk-meta.js.map
