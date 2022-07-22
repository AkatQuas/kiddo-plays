import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Bindings from "../../models/bindings/bindings.js";
import * as TextUtils from "../../models/text_utils/text_utils.js";
import * as TimelineModel from "../../models/timeline_model/timeline_model.js";
const UIStrings = {
  malformedTimelineDataUnknownJson: "Malformed timeline data: Unknown JSON format",
  malformedTimelineInputWrongJson: "Malformed timeline input, wrong JSON brackets balance",
  malformedTimelineDataS: "Malformed timeline data: {PH1}",
  legacyTimelineFormatIsNot: "Legacy Timeline format is not supported.",
  malformedCpuProfileFormat: "Malformed CPU profile format"
};
const str_ = i18n.i18n.registerUIStrings("panels/timeline/TimelineLoader.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class TimelineLoader {
  client;
  backingStorage;
  tracingModel;
  canceledCallback;
  state;
  buffer;
  firstRawChunk;
  firstChunk;
  loadedBytes;
  totalSize;
  jsonTokenizer;
  constructor(client) {
    this.client = client;
    this.backingStorage = new Bindings.TempFile.TempFileBackingStorage();
    this.tracingModel = new SDK.TracingModel.TracingModel(this.backingStorage);
    this.canceledCallback = null;
    this.state = State.Initial;
    this.buffer = "";
    this.firstRawChunk = true;
    this.firstChunk = true;
    this.loadedBytes = 0;
    this.jsonTokenizer = new TextUtils.TextUtils.BalancedJSONTokenizer(this.writeBalancedJSON.bind(this), true);
  }
  static loadFromFile(file, client) {
    const loader = new TimelineLoader(client);
    const fileReader = new Bindings.FileUtils.ChunkedFileReader(file, TransferChunkLengthBytes);
    loader.canceledCallback = fileReader.cancel.bind(fileReader);
    loader.totalSize = file.size;
    void fileReader.read(loader).then((success) => {
      if (!success && fileReader.error()) {
        loader.reportErrorAndCancelLoading(fileReader.error().message);
      }
    });
    return loader;
  }
  static loadFromEvents(events, client) {
    const loader = new TimelineLoader(client);
    window.setTimeout(async () => {
      const eventsPerChunk = 5e3;
      client.loadingStarted();
      for (let i = 0; i < events.length; i += eventsPerChunk) {
        const chunk = events.slice(i, i + eventsPerChunk);
        loader.tracingModel.addEvents(chunk);
        client.loadingProgress((i + chunk.length) / events.length);
        await new Promise((r) => window.setTimeout(r));
      }
      void loader.close();
    });
    return loader;
  }
  static loadFromURL(url, client) {
    const loader = new TimelineLoader(client);
    Host.ResourceLoader.loadAsStream(url, null, loader);
    return loader;
  }
  cancel() {
    this.tracingModel = null;
    this.backingStorage.reset();
    if (this.client) {
      this.client.loadingComplete(null);
      this.client = null;
    }
    if (this.canceledCallback) {
      this.canceledCallback();
    }
  }
  async write(chunk) {
    if (!this.client) {
      return Promise.resolve();
    }
    this.loadedBytes += chunk.length;
    if (this.firstRawChunk) {
      await this.client.loadingStarted();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    } else {
      let progress = void 0;
      if (this.totalSize) {
        progress = this.loadedBytes / this.totalSize;
        progress = progress > 1 ? progress - Math.floor(progress) : progress;
      }
      await this.client.loadingProgress(progress);
    }
    this.firstRawChunk = false;
    if (this.state === State.Initial) {
      if (chunk.startsWith('{"nodes":[')) {
        this.state = State.LoadingCPUProfileFormat;
      } else if (chunk[0] === "{") {
        this.state = State.LookingForEvents;
      } else if (chunk[0] === "[") {
        this.state = State.ReadingEvents;
      } else {
        this.reportErrorAndCancelLoading(i18nString(UIStrings.malformedTimelineDataUnknownJson));
        return Promise.resolve();
      }
    }
    if (this.state === State.LoadingCPUProfileFormat) {
      this.buffer += chunk;
      return Promise.resolve();
    }
    if (this.state === State.LookingForEvents) {
      const objectName = '"traceEvents":';
      const startPos = this.buffer.length - objectName.length;
      this.buffer += chunk;
      const pos = this.buffer.indexOf(objectName, startPos);
      if (pos === -1) {
        return Promise.resolve();
      }
      chunk = this.buffer.slice(pos + objectName.length);
      this.state = State.ReadingEvents;
    }
    if (this.state !== State.ReadingEvents) {
      return Promise.resolve();
    }
    if (this.jsonTokenizer.write(chunk)) {
      return Promise.resolve();
    }
    this.state = State.SkippingTail;
    if (this.firstChunk) {
      this.reportErrorAndCancelLoading(i18nString(UIStrings.malformedTimelineInputWrongJson));
    }
    return Promise.resolve();
  }
  writeBalancedJSON(data) {
    let json = data + "]";
    if (!this.firstChunk) {
      const commaIndex = json.indexOf(",");
      if (commaIndex !== -1) {
        json = json.slice(commaIndex + 1);
      }
      json = "[" + json;
    }
    let items;
    try {
      items = JSON.parse(json);
    } catch (e) {
      this.reportErrorAndCancelLoading(i18nString(UIStrings.malformedTimelineDataS, { PH1: e.toString() }));
      return;
    }
    if (this.firstChunk) {
      this.firstChunk = false;
      if (this.looksLikeAppVersion(items[0])) {
        this.reportErrorAndCancelLoading(i18nString(UIStrings.legacyTimelineFormatIsNot));
        return;
      }
    }
    try {
      this.tracingModel.addEvents(items);
    } catch (e) {
      this.reportErrorAndCancelLoading(i18nString(UIStrings.malformedTimelineDataS, { PH1: e.toString() }));
    }
  }
  reportErrorAndCancelLoading(message) {
    if (message) {
      Common.Console.Console.instance().error(message);
    }
    this.cancel();
  }
  looksLikeAppVersion(item) {
    return typeof item === "string" && item.indexOf("Chrome") !== -1;
  }
  async close() {
    if (!this.client) {
      return;
    }
    this.client.processingStarted();
    window.setTimeout(() => this.finalizeTrace(), 0);
  }
  finalizeTrace() {
    if (this.state === State.LoadingCPUProfileFormat) {
      this.parseCPUProfileFormat(this.buffer);
      this.buffer = "";
    }
    this.tracingModel.tracingComplete();
    this.client.loadingComplete(this.tracingModel);
  }
  parseCPUProfileFormat(text) {
    let traceEvents;
    try {
      const profile = JSON.parse(text);
      traceEvents = TimelineModel.TimelineJSProfile.TimelineJSProfileProcessor.buildTraceProfileFromCpuProfile(profile, 1, true);
    } catch (e) {
      this.reportErrorAndCancelLoading(i18nString(UIStrings.malformedCpuProfileFormat));
      return;
    }
    this.tracingModel.addEvents(traceEvents);
  }
}
export const TransferChunkLengthBytes = 5e6;
export var State = /* @__PURE__ */ ((State2) => {
  State2["Initial"] = "Initial";
  State2["LookingForEvents"] = "LookingForEvents";
  State2["ReadingEvents"] = "ReadingEvents";
  State2["SkippingTail"] = "SkippingTail";
  State2["LoadingCPUProfileFormat"] = "LoadingCPUProfileFormat";
  return State2;
})(State || {});
//# sourceMappingURL=TimelineLoader.js.map
