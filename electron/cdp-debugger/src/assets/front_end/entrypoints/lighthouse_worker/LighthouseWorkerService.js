import * as Root from "../../core/root/root.js";
import * as Puppeteer from "../../services/puppeteer/puppeteer.js";
function disableLoggingForTest() {
  console.log = () => void 0;
}
class LegacyPort {
  onMessage;
  onClose;
  on(eventName, callback) {
    if (eventName === "message") {
      this.onMessage = callback;
    } else if (eventName === "close") {
      this.onClose = callback;
    }
  }
  send(message) {
    notifyFrontendViaWorkerMessage("sendProtocolMessage", { message });
  }
  close() {
  }
}
class ConnectionProxy {
  sessionId;
  onMessage;
  onDisconnect;
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.onMessage = null;
    this.onDisconnect = null;
  }
  setOnMessage(onMessage) {
    this.onMessage = onMessage;
  }
  setOnDisconnect(onDisconnect) {
    this.onDisconnect = onDisconnect;
  }
  getOnDisconnect() {
    return this.onDisconnect;
  }
  getSessionId() {
    return this.sessionId;
  }
  sendRawMessage(message) {
    notifyFrontendViaWorkerMessage("sendProtocolMessage", { message });
  }
  async disconnect() {
    this.onDisconnect?.("force disconnect");
    this.onDisconnect = null;
    this.onMessage = null;
  }
}
const legacyPort = new LegacyPort();
let cdpConnection;
let endTimespan;
async function invokeLH(action, args) {
  if (Root.Runtime.Runtime.queryParam("isUnderTest")) {
    disableLoggingForTest();
    args.flags.maxWaitForLoad = 2 * 1e3;
  }
  self.listenForStatus((message) => {
    notifyFrontendViaWorkerMessage("statusUpdate", { message: message[1] });
  });
  let puppeteerConnection;
  try {
    if (action === "endTimespan") {
      if (!endTimespan) {
        throw new Error("Cannot end a timespan before starting one");
      }
      const result = await endTimespan();
      endTimespan = void 0;
      return result;
    }
    const locale = await fetchLocaleData(args.locales);
    const flags = args.flags;
    flags.logLevel = flags.logLevel || "info";
    flags.channel = "devtools";
    flags.locale = locale;
    if (action === "startTimespan" || action === "snapshot") {
      args.categoryIDs = args.categoryIDs.filter((c) => c !== "lighthouse-plugin-publisher-ads");
    }
    const config = self.createConfig(args.categoryIDs, flags.emulatedFormFactor);
    const url = args.url;
    if (action === "navigation" && flags.legacyNavigation) {
      const connection = self.setUpWorkerConnection(legacyPort);
      return await self.runLighthouse(url, flags, config, connection);
    }
    const { mainTargetId, mainFrameId, mainSessionId } = args.target;
    cdpConnection = new ConnectionProxy(mainSessionId);
    puppeteerConnection = await Puppeteer.PuppeteerConnection.getPuppeteerConnection(cdpConnection, mainFrameId, mainTargetId);
    const { page } = puppeteerConnection;
    const configContext = {
      logLevel: flags.logLevel,
      settingsOverrides: flags
    };
    if (action === "snapshot") {
      return await self.runLighthouseSnapshot({ config, page, configContext });
    }
    if (action === "startTimespan") {
      const timespan = await self.startLighthouseTimespan({ config, page, configContext });
      endTimespan = timespan.endTimespan;
      return;
    }
    return await self.runLighthouseNavigation(url, { config, page, configContext });
  } catch (err) {
    return {
      fatal: true,
      message: err.message,
      stack: err.stack
    };
  } finally {
    if (action !== "startTimespan") {
      puppeteerConnection?.browser.disconnect();
    }
  }
}
async function fetchLocaleData(locales) {
  const locale = self.lookupLocale(locales);
  if (locale === "en-US" || locale === "en") {
    return;
  }
  try {
    const remoteBase = Root.Runtime.getRemoteBase();
    let localeUrl;
    if (remoteBase && remoteBase.base) {
      localeUrl = `${remoteBase.base}third_party/lighthouse/locales/${locale}.json`;
    } else {
      localeUrl = new URL(`../../third_party/lighthouse/locales/${locale}.json`, import.meta.url).toString();
    }
    const timeoutPromise = new Promise((resolve, reject) => setTimeout(() => reject(new Error("timed out fetching locale")), 5e3));
    const localeData = await Promise.race([timeoutPromise, fetch(localeUrl).then((result) => result.json())]);
    self.registerLocaleData(locale, localeData);
    return locale;
  } catch (err) {
    console.error(err);
  }
  return;
}
function notifyFrontendViaWorkerMessage(action, args) {
  self.postMessage(JSON.stringify({ action, args }));
}
async function onFrontendMessage(event) {
  const messageFromFrontend = JSON.parse(event.data);
  switch (messageFromFrontend.action) {
    case "startTimespan":
    case "endTimespan":
    case "snapshot":
    case "navigation": {
      const result = await invokeLH(messageFromFrontend.action, messageFromFrontend.args);
      self.postMessage(JSON.stringify({ id: messageFromFrontend.id, result }));
      break;
    }
    case "dispatchProtocolMessage": {
      cdpConnection?.onMessage?.(JSON.parse(messageFromFrontend.args.message));
      legacyPort.onMessage?.(messageFromFrontend.args.message);
      break;
    }
    default: {
      throw new Error(`Unknown event: ${event.data}`);
    }
  }
}
self.onmessage = onFrontendMessage;
globalThis.global = self;
globalThis.global.isVinn = true;
globalThis.global.document = {};
globalThis.global.document.documentElement = {};
globalThis.global.document.documentElement.style = {
  WebkitAppearance: "WebkitAppearance"
};
//# sourceMappingURL=LighthouseWorkerService.js.map
