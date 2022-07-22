import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  state: "State",
  sampleRate: "Sample Rate",
  callbackBufferSize: "Callback Buffer Size",
  maxOutputChannels: "Max Output Channels",
  currentTime: "Current Time",
  callbackInterval: "Callback Interval",
  renderCapacity: "Render Capacity"
};
const str_ = i18n.i18n.registerUIStrings("panels/web_audio/AudioContextContentBuilder.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class ContextDetailBuilder {
  fragment;
  container;
  constructor(context) {
    this.fragment = document.createDocumentFragment();
    this.container = document.createElement("div");
    this.container.classList.add("context-detail-container");
    this.fragment.appendChild(this.container);
    this.build(context);
  }
  build(context) {
    const title = context.contextType === "realtime" ? i18n.i18n.lockedString("AudioContext") : i18n.i18n.lockedString("OfflineAudioContext");
    this.addTitle(title, context.contextId);
    this.addEntry(i18nString(UIStrings.state), context.contextState);
    this.addEntry(i18nString(UIStrings.sampleRate), context.sampleRate, "Hz");
    if (context.contextType === "realtime") {
      this.addEntry(i18nString(UIStrings.callbackBufferSize), context.callbackBufferSize, "frames");
    }
    this.addEntry(i18nString(UIStrings.maxOutputChannels), context.maxOutputChannelCount, "ch");
  }
  addTitle(title, subtitle) {
    this.container.appendChild(UI.Fragment.html`
  <div class="context-detail-header">
  <div class="context-detail-title">${title}</div>
  <div class="context-detail-subtitle">${subtitle}</div>
  </div>
  `);
  }
  addEntry(entry, value, unit) {
    const valueWithUnit = value + (unit ? ` ${unit}` : "");
    this.container.appendChild(UI.Fragment.html`
  <div class="context-detail-row">
  <div class="context-detail-row-entry">${entry}</div>
  <div class="context-detail-row-value">${valueWithUnit}</div>
  </div>
  `);
  }
  getFragment() {
    return this.fragment;
  }
}
export class ContextSummaryBuilder {
  fragment;
  constructor(contextId, contextRealtimeData) {
    const time = contextRealtimeData.currentTime.toFixed(3);
    const mean = (contextRealtimeData.callbackIntervalMean * 1e3).toFixed(3);
    const stddev = (Math.sqrt(contextRealtimeData.callbackIntervalVariance) * 1e3).toFixed(3);
    const capacity = (contextRealtimeData.renderCapacity * 100).toFixed(3);
    this.fragment = document.createDocumentFragment();
    this.fragment.appendChild(UI.Fragment.html`
  <div class="context-summary-container">
  <span>${i18nString(UIStrings.currentTime)}: ${time} s</span>
  <span>\u2758</span>
  <span>${i18nString(UIStrings.callbackInterval)}: μ = ${mean} ms, σ = ${stddev} ms</span>
  <span>\u2758</span>
  <span>${i18nString(UIStrings.renderCapacity)}: ${capacity} %</span>
  </div>
  `);
  }
  getFragment() {
    return this.fragment;
  }
}
//# sourceMappingURL=AudioContextContentBuilder.js.map
