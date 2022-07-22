import * as Platform from "../platform/platform.js";
import { Capability } from "./Target.js";
import { SDKModel } from "./SDKModel.js";
export class PerformanceMetricsModel extends SDKModel {
  #agent;
  #metricModes;
  #metricData;
  constructor(target) {
    super(target);
    this.#agent = target.performanceAgent();
    this.#metricModes = /* @__PURE__ */ new Map([
      ["TaskDuration", MetricMode.CumulativeTime],
      ["ScriptDuration", MetricMode.CumulativeTime],
      ["LayoutDuration", MetricMode.CumulativeTime],
      ["RecalcStyleDuration", MetricMode.CumulativeTime],
      ["LayoutCount", MetricMode.CumulativeCount],
      ["RecalcStyleCount", MetricMode.CumulativeCount]
    ]);
    this.#metricData = /* @__PURE__ */ new Map();
  }
  enable() {
    return this.#agent.invoke_enable({});
  }
  disable() {
    return this.#agent.invoke_disable();
  }
  async requestMetrics() {
    const rawMetrics = await this.#agent.invoke_getMetrics() || [];
    const metrics = /* @__PURE__ */ new Map();
    const timestamp = performance.now();
    for (const metric of rawMetrics.metrics) {
      let data = this.#metricData.get(metric.name);
      if (!data) {
        data = { lastValue: void 0, lastTimestamp: void 0 };
        this.#metricData.set(metric.name, data);
      }
      let value;
      switch (this.#metricModes.get(metric.name)) {
        case MetricMode.CumulativeTime:
          value = data.lastTimestamp && data.lastValue ? Platform.NumberUtilities.clamp((metric.value - data.lastValue) * 1e3 / (timestamp - data.lastTimestamp), 0, 1) : 0;
          data.lastValue = metric.value;
          data.lastTimestamp = timestamp;
          break;
        case MetricMode.CumulativeCount:
          value = data.lastTimestamp && data.lastValue ? Math.max(0, (metric.value - data.lastValue) * 1e3 / (timestamp - data.lastTimestamp)) : 0;
          data.lastValue = metric.value;
          data.lastTimestamp = timestamp;
          break;
        default:
          value = metric.value;
          break;
      }
      metrics.set(metric.name, value);
    }
    return { metrics, timestamp };
  }
}
var MetricMode = /* @__PURE__ */ ((MetricMode2) => {
  MetricMode2["CumulativeTime"] = "CumulativeTime";
  MetricMode2["CumulativeCount"] = "CumulativeCount";
  return MetricMode2;
})(MetricMode || {});
SDKModel.register(PerformanceMetricsModel, { capabilities: Capability.DOM, autostart: false });
//# sourceMappingURL=PerformanceMetricsModel.js.map
