import * as Common from "../common/common.js";
import * as i18n from "../i18n/i18n.js";
import * as Platform from "../platform/platform.js";
import { Type } from "./Target.js";
import { Events as TargetManagerEvents, TargetManager } from "./TargetManager.js";
import { TextSourceMap } from "./SourceMap.js";
const UIStrings = {
  devtoolsFailedToLoadSourcemapS: "DevTools failed to load source map: {PH1}"
};
const str_ = i18n.i18n.registerUIStrings("core/sdk/SourceMapManager.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class SourceMapManager extends Common.ObjectWrapper.ObjectWrapper {
  #target;
  #isEnabled;
  #relativeSourceURL;
  #relativeSourceMapURL;
  #resolvedSourceMapId;
  #sourceMapById;
  #sourceMapIdToLoadingClients;
  #sourceMapIdToClients;
  constructor(target) {
    super();
    this.#target = target;
    this.#isEnabled = true;
    this.#relativeSourceURL = /* @__PURE__ */ new Map();
    this.#relativeSourceMapURL = /* @__PURE__ */ new Map();
    this.#resolvedSourceMapId = /* @__PURE__ */ new Map();
    this.#sourceMapById = /* @__PURE__ */ new Map();
    this.#sourceMapIdToLoadingClients = new Platform.MapUtilities.Multimap();
    this.#sourceMapIdToClients = new Platform.MapUtilities.Multimap();
    TargetManager.instance().addEventListener(TargetManagerEvents.InspectedURLChanged, this.inspectedURLChanged, this);
  }
  setEnabled(isEnabled) {
    if (isEnabled === this.#isEnabled) {
      return;
    }
    this.#isEnabled = isEnabled;
    const clients = [...this.#resolvedSourceMapId.keys()];
    for (const client of clients) {
      const relativeSourceURL = this.#relativeSourceURL.get(client);
      const relativeSourceMapURL = this.#relativeSourceMapURL.get(client);
      this.detachSourceMap(client);
      this.attachSourceMap(client, relativeSourceURL, relativeSourceMapURL);
    }
  }
  getBaseUrl() {
    let target = this.#target;
    while (target && target.type() !== Type.Frame) {
      target = target.parentTarget();
    }
    return target?.inspectedURL() ?? Platform.DevToolsPath.EmptyUrlString;
  }
  inspectedURLChanged(event) {
    if (event.data !== this.#target) {
      return;
    }
    const prevSourceMapIds = new Map(this.#resolvedSourceMapId);
    for (const [client, prevSourceMapId] of prevSourceMapIds) {
      const relativeSourceURL = this.#relativeSourceURL.get(client);
      const relativeSourceMapURL = this.#relativeSourceMapURL.get(client);
      if (relativeSourceURL === void 0 || relativeSourceMapURL === void 0) {
        continue;
      }
      const resolvedUrls = this.resolveRelativeURLs(relativeSourceURL, relativeSourceMapURL);
      if (resolvedUrls !== null && prevSourceMapId !== resolvedUrls.sourceMapId) {
        this.detachSourceMap(client);
        this.attachSourceMap(client, relativeSourceURL, relativeSourceMapURL);
      }
    }
  }
  sourceMapForClient(client) {
    const sourceMapId = this.#resolvedSourceMapId.get(client);
    if (!sourceMapId) {
      return null;
    }
    return this.#sourceMapById.get(sourceMapId) || null;
  }
  sourceMapForClientPromise(client) {
    const sourceMapId = this.#resolvedSourceMapId.get(client);
    if (!sourceMapId) {
      return Promise.resolve(null);
    }
    const sourceMap = this.sourceMapForClient(client);
    if (sourceMap) {
      return Promise.resolve(sourceMap);
    }
    if (!this.#sourceMapIdToLoadingClients.has(sourceMapId)) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const sourceMapAddedDescriptor = this.addEventListener(Events.SourceMapAttached, (event) => {
        if (event.data.client !== client) {
          return;
        }
        this.removeEventListener(Events.SourceMapAttached, sourceMapAddedDescriptor.listener);
        this.removeEventListener(Events.SourceMapFailedToAttach, sourceMapFailedDescriptor.listener);
        resolve(event.data.sourceMap);
      });
      const sourceMapFailedDescriptor = this.addEventListener(Events.SourceMapFailedToAttach, (event) => {
        if (event.data.client !== client) {
          return;
        }
        this.removeEventListener(Events.SourceMapAttached, sourceMapAddedDescriptor.listener);
        this.removeEventListener(Events.SourceMapFailedToAttach, sourceMapFailedDescriptor.listener);
        resolve(null);
      });
    });
  }
  clientsForSourceMap(sourceMap) {
    const sourceMapId = this.getSourceMapId(sourceMap.compiledURL(), sourceMap.url());
    if (this.#sourceMapIdToClients.has(sourceMapId)) {
      return [...this.#sourceMapIdToClients.get(sourceMapId)];
    }
    return [...this.#sourceMapIdToLoadingClients.get(sourceMapId)];
  }
  getSourceMapId(sourceURL, sourceMapURL) {
    return `${sourceURL}:${sourceMapURL}`;
  }
  resolveRelativeURLs(sourceURL, sourceMapURL) {
    const resolvedSourceURL = Common.ParsedURL.ParsedURL.completeURL(this.getBaseUrl(), sourceURL);
    if (!resolvedSourceURL) {
      return null;
    }
    const resolvedSourceMapURL = Common.ParsedURL.ParsedURL.completeURL(resolvedSourceURL, sourceMapURL);
    if (!resolvedSourceMapURL) {
      return null;
    }
    return {
      sourceURL: resolvedSourceURL,
      sourceMapURL: resolvedSourceMapURL,
      sourceMapId: this.getSourceMapId(resolvedSourceURL, resolvedSourceMapURL)
    };
  }
  attachSourceMap(client, relativeSourceURL, relativeSourceMapURL) {
    if (relativeSourceURL === void 0 || !relativeSourceMapURL) {
      return;
    }
    console.assert(!this.#resolvedSourceMapId.has(client), "SourceMap is already attached to client");
    const resolvedURLs = this.resolveRelativeURLs(relativeSourceURL, relativeSourceMapURL);
    if (!resolvedURLs) {
      return;
    }
    this.#relativeSourceURL.set(client, relativeSourceURL);
    this.#relativeSourceMapURL.set(client, relativeSourceMapURL);
    const { sourceURL, sourceMapURL, sourceMapId } = resolvedURLs;
    this.#resolvedSourceMapId.set(client, sourceMapId);
    if (!this.#isEnabled) {
      return;
    }
    this.dispatchEventToListeners(Events.SourceMapWillAttach, { client });
    if (this.#sourceMapById.has(sourceMapId)) {
      attach.call(this, sourceMapId, client);
      return;
    }
    if (!this.#sourceMapIdToLoadingClients.has(sourceMapId)) {
      void TextSourceMap.load(sourceMapURL, sourceURL, client.createPageResourceLoadInitiator()).catch((error) => {
        Common.Console.Console.instance().warn(i18nString(UIStrings.devtoolsFailedToLoadSourcemapS, { PH1: error.message }));
        return null;
      }).then(onSourceMap.bind(this, sourceMapId));
    }
    this.#sourceMapIdToLoadingClients.set(sourceMapId, client);
    function onSourceMap(sourceMapId2, sourceMap) {
      this.sourceMapLoadedForTest();
      const clients = this.#sourceMapIdToLoadingClients.get(sourceMapId2);
      this.#sourceMapIdToLoadingClients.deleteAll(sourceMapId2);
      if (!clients.size) {
        return;
      }
      if (!sourceMap) {
        for (const client2 of clients) {
          this.dispatchEventToListeners(Events.SourceMapFailedToAttach, { client: client2 });
        }
        return;
      }
      this.#sourceMapById.set(sourceMapId2, sourceMap);
      for (const client2 of clients) {
        attach.call(this, sourceMapId2, client2);
      }
    }
    function attach(sourceMapId2, client2) {
      this.#sourceMapIdToClients.set(sourceMapId2, client2);
      const sourceMap = this.#sourceMapById.get(sourceMapId2);
      this.dispatchEventToListeners(Events.SourceMapAttached, { client: client2, sourceMap });
    }
  }
  detachSourceMap(client) {
    const sourceMapId = this.#resolvedSourceMapId.get(client);
    this.#relativeSourceURL.delete(client);
    this.#relativeSourceMapURL.delete(client);
    this.#resolvedSourceMapId.delete(client);
    if (!sourceMapId) {
      return;
    }
    if (!this.#sourceMapIdToClients.hasValue(sourceMapId, client)) {
      if (this.#sourceMapIdToLoadingClients.delete(sourceMapId, client)) {
        this.dispatchEventToListeners(Events.SourceMapFailedToAttach, { client });
      }
      return;
    }
    this.#sourceMapIdToClients.delete(sourceMapId, client);
    const sourceMap = this.#sourceMapById.get(sourceMapId);
    if (!sourceMap) {
      return;
    }
    if (!this.#sourceMapIdToClients.has(sourceMapId)) {
      this.#sourceMapById.delete(sourceMapId);
    }
    this.dispatchEventToListeners(Events.SourceMapDetached, { client, sourceMap });
  }
  sourceMapLoadedForTest() {
  }
  dispose() {
    TargetManager.instance().removeEventListener(TargetManagerEvents.InspectedURLChanged, this.inspectedURLChanged, this);
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["SourceMapWillAttach"] = "SourceMapWillAttach";
  Events2["SourceMapFailedToAttach"] = "SourceMapFailedToAttach";
  Events2["SourceMapAttached"] = "SourceMapAttached";
  Events2["SourceMapDetached"] = "SourceMapDetached";
  return Events2;
})(Events || {});
//# sourceMappingURL=SourceMapManager.js.map
