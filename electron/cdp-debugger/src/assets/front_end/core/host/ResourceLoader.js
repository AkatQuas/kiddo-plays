import * as Common from "../common/common.js";
import * as i18n from "../i18n/i18n.js";
import { InspectorFrontendHostInstance } from "./InspectorFrontendHost.js";
const UIStrings = {
  systemError: "System error",
  connectionError: "Connection error",
  certificateError: "Certificate error",
  httpError: "HTTP error",
  cacheError: "Cache error",
  signedExchangeError: "Signed Exchange error",
  ftpError: "FTP error",
  certificateManagerError: "Certificate manager error",
  dnsResolverError: "DNS resolver error",
  unknownError: "Unknown error",
  httpErrorStatusCodeSS: "HTTP error: status code {PH1}, {PH2}",
  invalidUrl: "Invalid URL",
  decodingDataUrlFailed: "Decoding Data URL failed"
};
const str_ = i18n.i18n.registerUIStrings("core/host/ResourceLoader.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export const ResourceLoader = {};
let _lastStreamId = 0;
const _boundStreams = {};
const _bindOutputStream = function(stream) {
  _boundStreams[++_lastStreamId] = stream;
  return _lastStreamId;
};
const _discardOutputStream = function(id) {
  void _boundStreams[id].close();
  delete _boundStreams[id];
};
export const streamWrite = function(id, chunk) {
  void _boundStreams[id].write(chunk);
};
export let load = function(url, headers, callback) {
  const stream = new Common.StringOutputStream.StringOutputStream();
  loadAsStream(url, headers, stream, mycallback);
  function mycallback(success, headers2, errorDescription) {
    callback(success, headers2, stream.data(), errorDescription);
  }
};
export function setLoadForTest(newLoad) {
  load = newLoad;
}
function getNetErrorCategory(netError) {
  if (netError > -100) {
    return i18nString(UIStrings.systemError);
  }
  if (netError > -200) {
    return i18nString(UIStrings.connectionError);
  }
  if (netError > -300) {
    return i18nString(UIStrings.certificateError);
  }
  if (netError > -400) {
    return i18nString(UIStrings.httpError);
  }
  if (netError > -500) {
    return i18nString(UIStrings.cacheError);
  }
  if (netError > -600) {
    return i18nString(UIStrings.signedExchangeError);
  }
  if (netError > -700) {
    return i18nString(UIStrings.ftpError);
  }
  if (netError > -800) {
    return i18nString(UIStrings.certificateManagerError);
  }
  if (netError > -900) {
    return i18nString(UIStrings.dnsResolverError);
  }
  return i18nString(UIStrings.unknownError);
}
function isHTTPError(netError) {
  return netError <= -300 && netError > -400;
}
export function netErrorToMessage(netError, httpStatusCode, netErrorName) {
  if (netError === void 0 || netErrorName === void 0) {
    return null;
  }
  if (netError !== 0) {
    if (isHTTPError(netError)) {
      return i18nString(UIStrings.httpErrorStatusCodeSS, { PH1: String(httpStatusCode), PH2: netErrorName });
    }
    const errorCategory = getNetErrorCategory(netError);
    return `${errorCategory}: ${netErrorName}`;
  }
  return null;
}
function createErrorMessageFromResponse(response) {
  const { statusCode, netError, netErrorName, urlValid, messageOverride } = response;
  let message = "";
  const success = statusCode >= 200 && statusCode < 300;
  if (typeof messageOverride === "string") {
    message = messageOverride;
  } else if (!success) {
    if (typeof netError === "undefined") {
      if (urlValid === false) {
        message = i18nString(UIStrings.invalidUrl);
      } else {
        message = i18nString(UIStrings.unknownError);
      }
    } else {
      const maybeMessage = netErrorToMessage(netError, statusCode, netErrorName);
      if (maybeMessage) {
        message = maybeMessage;
      }
    }
  }
  console.assert(success === (message.length === 0));
  return { success, description: { statusCode, netError, netErrorName, urlValid, message } };
}
const loadXHR = (url) => {
  return new Promise((successCallback, failureCallback) => {
    function onReadyStateChanged() {
      if (xhr.readyState !== XMLHttpRequest.DONE) {
        return;
      }
      if (xhr.status !== 200) {
        xhr.onreadystatechange = null;
        failureCallback(new Error(String(xhr.status)));
        return;
      }
      xhr.onreadystatechange = null;
      successCallback(xhr.responseText);
    }
    const xhr = new XMLHttpRequest();
    xhr.withCredentials = false;
    xhr.open("GET", url, true);
    xhr.onreadystatechange = onReadyStateChanged;
    xhr.send(null);
  });
};
export const loadAsStream = function(url, headers, stream, callback) {
  const streamId = _bindOutputStream(stream);
  const parsedURL = new Common.ParsedURL.ParsedURL(url);
  if (parsedURL.isDataURL()) {
    loadXHR(url).then(dataURLDecodeSuccessful).catch(dataURLDecodeFailed);
    return;
  }
  const rawHeaders = [];
  if (headers) {
    for (const key in headers) {
      rawHeaders.push(key + ": " + headers[key]);
    }
  }
  InspectorFrontendHostInstance.loadNetworkResource(url, rawHeaders.join("\r\n"), streamId, finishedCallback);
  function finishedCallback(response) {
    if (callback) {
      const { success, description } = createErrorMessageFromResponse(response);
      callback(success, response.headers || {}, description);
    }
    _discardOutputStream(streamId);
  }
  function dataURLDecodeSuccessful(text) {
    streamWrite(streamId, text);
    finishedCallback({ statusCode: 200 });
  }
  function dataURLDecodeFailed(_xhrStatus) {
    const messageOverride = i18nString(UIStrings.decodingDataUrlFailed);
    finishedCallback({ statusCode: 404, messageOverride });
  }
};
//# sourceMappingURL=ResourceLoader.js.map
