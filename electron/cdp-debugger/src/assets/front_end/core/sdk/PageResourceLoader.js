import * as Common from "../common/common.js";
import * as Host from "../host/host.js";
import * as i18n from "../i18n/i18n.js";
import { FrameManager } from "./FrameManager.js";
import { IOModel } from "./IOModel.js";
import { MultitargetNetworkManager } from "./NetworkManager.js";
import { NetworkManager } from "./NetworkManager.js";
import { Events as ResourceTreeModelEvents, ResourceTreeModel } from "./ResourceTreeModel.js";
import { TargetManager } from "./TargetManager.js";
const UIStrings = {
  loadCanceledDueToReloadOf: "Load canceled due to reload of inspected page",
  loadCanceledDueToLoadTimeout: "Load canceled due to load timeout"
};
const str_ = i18n.i18n.registerUIStrings("core/sdk/PageResourceLoader.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let pageResourceLoader = null;
export class PageResourceLoader extends Common.ObjectWrapper.ObjectWrapper {
  #currentlyLoading;
  #maxConcurrentLoads;
  #pageResources;
  #queuedLoads;
  #loadOverride;
  #loadTimeout;
  constructor(loadOverride, maxConcurrentLoads, loadTimeout) {
    super();
    this.#currentlyLoading = 0;
    this.#maxConcurrentLoads = maxConcurrentLoads;
    this.#pageResources = /* @__PURE__ */ new Map();
    this.#queuedLoads = [];
    TargetManager.instance().addModelListener(ResourceTreeModel, ResourceTreeModelEvents.MainFrameNavigated, this.onMainFrameNavigated, this);
    this.#loadOverride = loadOverride;
    this.#loadTimeout = loadTimeout;
  }
  static instance({ forceNew, loadOverride, maxConcurrentLoads, loadTimeout } = {
    forceNew: false,
    loadOverride: null,
    maxConcurrentLoads: 500,
    loadTimeout: 3e4
  }) {
    if (!pageResourceLoader || forceNew) {
      pageResourceLoader = new PageResourceLoader(loadOverride, maxConcurrentLoads, loadTimeout);
    }
    return pageResourceLoader;
  }
  onMainFrameNavigated(event) {
    const mainFrame = event.data;
    if (!mainFrame.isTopFrame()) {
      return;
    }
    for (const { reject } of this.#queuedLoads) {
      reject(new Error(i18nString(UIStrings.loadCanceledDueToReloadOf)));
    }
    this.#queuedLoads = [];
    this.#pageResources.clear();
    this.dispatchEventToListeners(Events.Update);
  }
  getResourcesLoaded() {
    return this.#pageResources;
  }
  getNumberOfResources() {
    return { loading: this.#currentlyLoading, queued: this.#queuedLoads.length, resources: this.#pageResources.size };
  }
  async acquireLoadSlot() {
    this.#currentlyLoading++;
    if (this.#currentlyLoading > this.#maxConcurrentLoads) {
      const entry = { resolve: () => {
      }, reject: () => {
      } };
      const waitForCapacity = new Promise((resolve, reject) => {
        entry.resolve = resolve;
        entry.reject = reject;
      });
      this.#queuedLoads.push(entry);
      await waitForCapacity;
    }
  }
  releaseLoadSlot() {
    this.#currentlyLoading--;
    const entry = this.#queuedLoads.shift();
    if (entry) {
      entry.resolve();
    }
  }
  static async withTimeout(promise, timeout) {
    const timeoutPromise = new Promise((_, reject) => window.setTimeout(reject, timeout, new Error(i18nString(UIStrings.loadCanceledDueToLoadTimeout))));
    return Promise.race([promise, timeoutPromise]);
  }
  static makeKey(url, initiator) {
    if (initiator.frameId) {
      return `${url}-${initiator.frameId}`;
    }
    if (initiator.target) {
      return `${url}-${initiator.target.id()}`;
    }
    throw new Error("Invalid initiator");
  }
  async loadResource(url, initiator) {
    const key = PageResourceLoader.makeKey(url, initiator);
    const pageResource = { success: null, size: null, errorMessage: void 0, url, initiator };
    this.#pageResources.set(key, pageResource);
    this.dispatchEventToListeners(Events.Update);
    try {
      await this.acquireLoadSlot();
      const resultPromise = this.dispatchLoad(url, initiator);
      const result = await PageResourceLoader.withTimeout(resultPromise, this.#loadTimeout);
      pageResource.errorMessage = result.errorDescription.message;
      pageResource.success = result.success;
      if (result.success) {
        pageResource.size = result.content.length;
        return { content: result.content };
      }
      throw new Error(result.errorDescription.message);
    } catch (e) {
      if (pageResource.errorMessage === void 0) {
        pageResource.errorMessage = e.message;
      }
      if (pageResource.success === null) {
        pageResource.success = false;
      }
      throw e;
    } finally {
      this.releaseLoadSlot();
      this.dispatchEventToListeners(Events.Update);
    }
  }
  async dispatchLoad(url, initiator) {
    let failureReason = null;
    if (this.#loadOverride) {
      return this.#loadOverride(url);
    }
    const parsedURL = new Common.ParsedURL.ParsedURL(url);
    const eligibleForLoadFromTarget = getLoadThroughTargetSetting().get() && parsedURL && parsedURL.scheme !== "file" && parsedURL.scheme !== "data" && parsedURL.scheme !== "devtools";
    Host.userMetrics.developerResourceScheme(this.getDeveloperResourceScheme(parsedURL));
    if (eligibleForLoadFromTarget) {
      try {
        if (initiator.target) {
          Host.userMetrics.developerResourceLoaded(Host.UserMetrics.DeveloperResourceLoaded.LoadThroughPageViaTarget);
          const result2 = await this.loadFromTarget(initiator.target, initiator.frameId, url);
          return result2;
        }
        const frame = FrameManager.instance().getFrame(initiator.frameId);
        if (frame) {
          Host.userMetrics.developerResourceLoaded(Host.UserMetrics.DeveloperResourceLoaded.LoadThroughPageViaFrame);
          const result2 = await this.loadFromTarget(frame.resourceTreeModel().target(), initiator.frameId, url);
          return result2;
        }
      } catch (e) {
        if (e instanceof Error) {
          Host.userMetrics.developerResourceLoaded(Host.UserMetrics.DeveloperResourceLoaded.LoadThroughPageFailure);
          failureReason = e.message;
        }
      }
      Host.userMetrics.developerResourceLoaded(Host.UserMetrics.DeveloperResourceLoaded.LoadThroughPageFallback);
      console.warn("Fallback triggered", url, initiator);
    } else {
      const code = getLoadThroughTargetSetting().get() ? Host.UserMetrics.DeveloperResourceLoaded.FallbackPerProtocol : Host.UserMetrics.DeveloperResourceLoaded.FallbackPerOverride;
      Host.userMetrics.developerResourceLoaded(code);
    }
    const result = await MultitargetNetworkManager.instance().loadResource(url);
    if (eligibleForLoadFromTarget && !result.success) {
      Host.userMetrics.developerResourceLoaded(Host.UserMetrics.DeveloperResourceLoaded.FallbackFailure);
    }
    if (failureReason) {
      result.errorDescription.message = `Fetch through target failed: ${failureReason}; Fallback: ${result.errorDescription.message}`;
    }
    return result;
  }
  getDeveloperResourceScheme(parsedURL) {
    if (!parsedURL || parsedURL.scheme === "") {
      return Host.UserMetrics.DeveloperResourceScheme.SchemeUnknown;
    }
    const isLocalhost = parsedURL.host === "localhost" || parsedURL.host.endsWith(".localhost");
    switch (parsedURL.scheme) {
      case "file":
        return Host.UserMetrics.DeveloperResourceScheme.SchemeFile;
      case "data":
        return Host.UserMetrics.DeveloperResourceScheme.SchemeData;
      case "blob":
        return Host.UserMetrics.DeveloperResourceScheme.SchemeBlob;
      case "http":
        return isLocalhost ? Host.UserMetrics.DeveloperResourceScheme.SchemeHttpLocalhost : Host.UserMetrics.DeveloperResourceScheme.SchemeHttp;
      case "https":
        return isLocalhost ? Host.UserMetrics.DeveloperResourceScheme.SchemeHttpsLocalhost : Host.UserMetrics.DeveloperResourceScheme.SchemeHttps;
    }
    return Host.UserMetrics.DeveloperResourceScheme.SchemeOther;
  }
  async loadFromTarget(target, frameId, url) {
    const networkManager = target.model(NetworkManager);
    const ioModel = target.model(IOModel);
    const resource = await networkManager.loadNetworkResource(frameId, url, { disableCache: true, includeCredentials: true });
    try {
      const content = resource.stream ? await ioModel.readToString(resource.stream) : "";
      return {
        success: resource.success,
        content,
        errorDescription: {
          statusCode: resource.httpStatusCode || 0,
          netError: resource.netError,
          netErrorName: resource.netErrorName,
          message: Host.ResourceLoader.netErrorToMessage(resource.netError, resource.httpStatusCode, resource.netErrorName) || "",
          urlValid: void 0
        }
      };
    } finally {
      if (resource.stream) {
        void ioModel.close(resource.stream);
      }
    }
  }
}
export function getLoadThroughTargetSetting() {
  return Common.Settings.Settings.instance().createSetting("loadThroughTarget", true);
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["Update"] = "Update";
  return Events2;
})(Events || {});
//# sourceMappingURL=PageResourceLoader.js.map
