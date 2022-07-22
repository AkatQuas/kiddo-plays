import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  performanceMonitor: "Performance monitor",
  performance: "performance",
  systemMonitor: "system monitor",
  monitor: "monitor",
  activity: "activity",
  metrics: "metrics",
  showPerformanceMonitor: "Show Performance monitor"
};
const str_ = i18n.i18n.registerUIStrings("panels/performance_monitor/performance_monitor-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedPerformanceMonitorModule;
async function loadPerformanceMonitorModule() {
  if (!loadedPerformanceMonitorModule) {
    loadedPerformanceMonitorModule = await import("./performance_monitor.js");
  }
  return loadedPerformanceMonitorModule;
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.DRAWER_VIEW,
  id: "performance.monitor",
  title: i18nLazyString(UIStrings.performanceMonitor),
  commandPrompt: i18nLazyString(UIStrings.showPerformanceMonitor),
  persistence: UI.ViewManager.ViewPersistence.CLOSEABLE,
  order: 100,
  async loadView() {
    const PerformanceMonitor = await loadPerformanceMonitorModule();
    return PerformanceMonitor.PerformanceMonitor.PerformanceMonitorImpl.instance();
  },
  tags: [
    i18nLazyString(UIStrings.performance),
    i18nLazyString(UIStrings.systemMonitor),
    i18nLazyString(UIStrings.monitor),
    i18nLazyString(UIStrings.activity),
    i18nLazyString(UIStrings.metrics)
  ]
});
//# sourceMappingURL=performance_monitor-meta.js.map
