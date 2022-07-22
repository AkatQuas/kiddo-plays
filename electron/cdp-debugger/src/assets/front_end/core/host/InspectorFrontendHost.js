import * as Common from "../common/common.js";
import * as i18n from "../i18n/i18n.js";
import * as Platform from "../platform/platform.js";
import * as Root from "../root/root.js";
import { EventDescriptors, Events } from "./InspectorFrontendHostAPI.js";
import { streamWrite as resourceLoaderStreamWrite } from "./ResourceLoader.js";
const UIStrings = {
  devtoolsS: "DevTools - {PH1}"
};
const str_ = i18n.i18n.registerUIStrings("core/host/InspectorFrontendHost.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const MAX_RECORDED_HISTOGRAMS_SIZE = 100;
const OVERRIDES_FILE_SYSTEM_PATH = "/overrides";
export class InspectorFrontendHostStub {
  #urlsBeingSaved;
  events;
  #fileSystem = null;
  recordedEnumeratedHistograms = [];
  recordedPerformanceHistograms = [];
  constructor() {
    function stopEventPropagation(event) {
      const zoomModifier = this.platform() === "mac" ? event.metaKey : event.ctrlKey;
      if (zoomModifier && (event.key === "+" || event.key === "-")) {
        event.stopPropagation();
      }
    }
    document.addEventListener("keydown", (event) => {
      stopEventPropagation.call(this, event);
    }, true);
    this.#urlsBeingSaved = /* @__PURE__ */ new Map();
  }
  platform() {
    const userAgent = navigator.userAgent;
    if (userAgent.includes("Windows NT")) {
      return "windows";
    }
    if (userAgent.includes("Mac OS X")) {
      return "mac";
    }
    return "linux";
  }
  loadCompleted() {
  }
  bringToFront() {
  }
  closeWindow() {
  }
  setIsDocked(isDocked, callback) {
    window.setTimeout(callback, 0);
  }
  showSurvey(trigger, callback) {
    window.setTimeout(() => callback({ surveyShown: false }), 0);
  }
  canShowSurvey(trigger, callback) {
    window.setTimeout(() => callback({ canShowSurvey: false }), 0);
  }
  setInspectedPageBounds(bounds) {
  }
  inspectElementCompleted() {
  }
  setInjectedScriptForOrigin(origin, script) {
  }
  inspectedURLChanged(url) {
    document.title = i18nString(UIStrings.devtoolsS, { PH1: url.replace(/^https?:\/\//, "") });
  }
  copyText(text) {
    if (text === void 0 || text === null) {
      return;
    }
    void navigator.clipboard.writeText(text);
  }
  openInNewTab(url) {
    window.open(url, "_blank");
  }
  showItemInFolder(fileSystemPath) {
    Common.Console.Console.instance().error("Show item in folder is not enabled in hosted mode. Please inspect using chrome://inspect");
  }
  save(url, content, forceSaveAs) {
    let buffer = this.#urlsBeingSaved.get(url);
    if (!buffer) {
      buffer = [];
      this.#urlsBeingSaved.set(url, buffer);
    }
    buffer.push(content);
    this.events.dispatchEventToListeners(Events.SavedURL, { url, fileSystemPath: url });
  }
  append(url, content) {
    const buffer = this.#urlsBeingSaved.get(url);
    if (buffer) {
      buffer.push(content);
      this.events.dispatchEventToListeners(Events.AppendedToURL, url);
    }
  }
  close(url) {
    const buffer = this.#urlsBeingSaved.get(url) || [];
    this.#urlsBeingSaved.delete(url);
    let fileName = "";
    if (url) {
      try {
        const trimmed = Platform.StringUtilities.trimURL(url);
        fileName = Platform.StringUtilities.removeURLFragment(trimmed);
      } catch (error) {
        fileName = url;
      }
    }
    const link = document.createElement("a");
    link.download = fileName;
    const blob = new Blob([buffer.join("")], { type: "text/plain" });
    const blobUrl = URL.createObjectURL(blob);
    link.href = blobUrl;
    link.click();
    URL.revokeObjectURL(blobUrl);
  }
  sendMessageToBackend(message) {
  }
  recordEnumeratedHistogram(actionName, actionCode, bucketSize) {
    if (this.recordedEnumeratedHistograms.length >= MAX_RECORDED_HISTOGRAMS_SIZE) {
      this.recordedEnumeratedHistograms.shift();
    }
    this.recordedEnumeratedHistograms.push({ actionName, actionCode });
  }
  recordPerformanceHistogram(histogramName, duration) {
    if (this.recordedPerformanceHistograms.length >= MAX_RECORDED_HISTOGRAMS_SIZE) {
      this.recordedPerformanceHistograms.shift();
    }
    this.recordedPerformanceHistograms.push({ histogramName, duration });
  }
  recordUserMetricsAction(umaName) {
  }
  requestFileSystems() {
    this.events.dispatchEventToListeners(Events.FileSystemsLoaded, []);
  }
  addFileSystem(type) {
    const onFileSystem = (fs) => {
      this.#fileSystem = fs;
      const fileSystem = {
        fileSystemName: "sandboxedRequestedFileSystem",
        fileSystemPath: OVERRIDES_FILE_SYSTEM_PATH,
        rootURL: "filesystem:devtools://devtools/isolated/",
        type: "overrides"
      };
      this.events.dispatchEventToListeners(Events.FileSystemAdded, { fileSystem });
    };
    window.webkitRequestFileSystem(window.TEMPORARY, 1024 * 1024, onFileSystem);
  }
  removeFileSystem(fileSystemPath) {
    const removalCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isDirectory) {
          entry.removeRecursively(() => {
          });
        } else if (entry.isFile) {
          entry.remove(() => {
          });
        }
      });
    };
    if (this.#fileSystem) {
      this.#fileSystem.root.createReader().readEntries(removalCallback);
    }
    this.#fileSystem = null;
    this.events.dispatchEventToListeners(Events.FileSystemRemoved, OVERRIDES_FILE_SYSTEM_PATH);
  }
  isolatedFileSystem(fileSystemId, registeredName) {
    return this.#fileSystem;
  }
  loadNetworkResource(url, headers, streamId, callback) {
    fetch(url).then((result) => result.text()).then(function(text) {
      resourceLoaderStreamWrite(streamId, text);
      callback({
        statusCode: 200,
        headers: void 0,
        messageOverride: void 0,
        netError: void 0,
        netErrorName: void 0,
        urlValid: void 0
      });
    }).catch(function() {
      callback({
        statusCode: 404,
        headers: void 0,
        messageOverride: void 0,
        netError: void 0,
        netErrorName: void 0,
        urlValid: void 0
      });
    });
  }
  registerPreference(name, options) {
  }
  getPreferences(callback) {
    const prefs = {};
    for (const name in window.localStorage) {
      prefs[name] = window.localStorage[name];
    }
    callback(prefs);
  }
  getPreference(name, callback) {
    callback(window.localStorage[name]);
  }
  setPreference(name, value) {
    window.localStorage[name] = value;
  }
  removePreference(name) {
    delete window.localStorage[name];
  }
  clearPreferences() {
    window.localStorage.clear();
  }
  getSyncInformation(callback) {
    callback({
      isSyncActive: false,
      arePreferencesSynced: false
    });
  }
  upgradeDraggedFileSystemPermissions(fileSystem) {
  }
  indexPath(requestId, fileSystemPath, excludedFolders) {
  }
  stopIndexing(requestId) {
  }
  searchInPath(requestId, fileSystemPath, query) {
  }
  zoomFactor() {
    return 1;
  }
  zoomIn() {
  }
  zoomOut() {
  }
  resetZoom() {
  }
  setWhitelistedShortcuts(shortcuts) {
  }
  setEyeDropperActive(active) {
  }
  showCertificateViewer(certChain) {
  }
  reattach(callback) {
  }
  readyForTest() {
  }
  connectionReady() {
  }
  setOpenNewWindowForPopups(value) {
  }
  setDevicesDiscoveryConfig(config) {
  }
  setDevicesUpdatesEnabled(enabled) {
  }
  performActionOnRemotePage(pageId, action) {
  }
  openRemotePage(browserId, url) {
  }
  openNodeFrontend() {
  }
  showContextMenuAtPoint(x, y, items, document2) {
    throw "Soft context menu should be used";
  }
  isHostedMode() {
    return true;
  }
  setAddExtensionCallback(callback) {
  }
  async initialTargetId() {
    return null;
  }
}
export let InspectorFrontendHostInstance = window.InspectorFrontendHost;
class InspectorFrontendAPIImpl {
  constructor() {
    for (const descriptor of EventDescriptors) {
      this[descriptor[1]] = this.dispatch.bind(this, descriptor[0], descriptor[2], descriptor[3]);
    }
  }
  dispatch(name, signature, runOnceLoaded, ...params) {
    if (signature.length < 2) {
      try {
        InspectorFrontendHostInstance.events.dispatchEventToListeners(name, params[0]);
      } catch (error) {
        console.error(error + " " + error.stack);
      }
      return;
    }
    const data = {};
    for (let i = 0; i < signature.length; ++i) {
      data[signature[i]] = params[i];
    }
    try {
      InspectorFrontendHostInstance.events.dispatchEventToListeners(name, data);
    } catch (error) {
      console.error(error + " " + error.stack);
    }
  }
  streamWrite(id, chunk) {
    resourceLoaderStreamWrite(id, chunk);
  }
}
(function() {
  function initializeInspectorFrontendHost() {
    let proto;
    if (!InspectorFrontendHostInstance) {
      window.InspectorFrontendHost = InspectorFrontendHostInstance = new InspectorFrontendHostStub();
    } else {
      proto = InspectorFrontendHostStub.prototype;
      for (const name of Object.getOwnPropertyNames(proto)) {
        const stub = proto[name];
        if (typeof stub !== "function" || InspectorFrontendHostInstance[name]) {
          continue;
        }
        console.error(`Incompatible embedder: method Host.InspectorFrontendHost.${name} is missing. Using stub instead.`);
        InspectorFrontendHostInstance[name] = stub;
      }
    }
    InspectorFrontendHostInstance.events = new Common.ObjectWrapper.ObjectWrapper();
  }
  initializeInspectorFrontendHost();
  window.InspectorFrontendAPI = new InspectorFrontendAPIImpl();
})();
export function isUnderTest(prefs) {
  if (Root.Runtime.Runtime.queryParam("test")) {
    return true;
  }
  if (prefs) {
    return prefs["isUnderTest"] === "true";
  }
  return Common.Settings.Settings.hasInstance() && Common.Settings.Settings.instance().createSetting("isUnderTest", false).get();
}
//# sourceMappingURL=InspectorFrontendHost.js.map
