import * as i18n from "../i18n/i18n.js";
import { ParsedURL } from "./ParsedURL.js";
const UIStrings = {
  xhrAndFetch: "`XHR` and `Fetch`",
  scripts: "Scripts",
  js: "JS",
  stylesheets: "Stylesheets",
  css: "CSS",
  images: "Images",
  img: "Img",
  media: "Media",
  fonts: "Fonts",
  font: "Font",
  documents: "Documents",
  doc: "Doc",
  websockets: "WebSockets",
  ws: "WS",
  webassembly: "WebAssembly",
  wasm: "Wasm",
  manifest: "Manifest",
  other: "Other",
  document: "Document",
  stylesheet: "Stylesheet",
  image: "Image",
  script: "Script",
  texttrack: "TextTrack",
  fetch: "Fetch",
  eventsource: "EventSource",
  websocket: "WebSocket",
  webtransport: "WebTransport",
  signedexchange: "SignedExchange",
  ping: "Ping",
  cspviolationreport: "CSPViolationReport",
  preflight: "Preflight",
  webbundle: "WebBundle"
};
const str_ = i18n.i18n.registerUIStrings("core/common/ResourceType.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
export class ResourceType {
  #nameInternal;
  #titleInternal;
  #categoryInternal;
  #isTextTypeInternal;
  constructor(name, title, category, isTextType) {
    this.#nameInternal = name;
    this.#titleInternal = title;
    this.#categoryInternal = category;
    this.#isTextTypeInternal = isTextType;
  }
  static fromMimeType(mimeType) {
    if (!mimeType) {
      return resourceTypes.Other;
    }
    if (mimeType.startsWith("text/html")) {
      return resourceTypes.Document;
    }
    if (mimeType.startsWith("text/css")) {
      return resourceTypes.Stylesheet;
    }
    if (mimeType.startsWith("image/")) {
      return resourceTypes.Image;
    }
    if (mimeType.startsWith("text/")) {
      return resourceTypes.Script;
    }
    if (mimeType.includes("font")) {
      return resourceTypes.Font;
    }
    if (mimeType.includes("script")) {
      return resourceTypes.Script;
    }
    if (mimeType.includes("octet")) {
      return resourceTypes.Other;
    }
    if (mimeType.includes("application")) {
      return resourceTypes.Script;
    }
    return resourceTypes.Other;
  }
  static fromMimeTypeOverride(mimeType) {
    if (mimeType === "application/wasm") {
      return resourceTypes.Wasm;
    }
    if (mimeType === "application/webbundle") {
      return resourceTypes.WebBundle;
    }
    return null;
  }
  static fromURL(url) {
    return resourceTypeByExtension.get(ParsedURL.extractExtension(url)) || null;
  }
  static fromName(name) {
    for (const resourceTypeId in resourceTypes) {
      const resourceType = resourceTypes[resourceTypeId];
      if (resourceType.name() === name) {
        return resourceType;
      }
    }
    return null;
  }
  static mimeFromURL(url) {
    const name = ParsedURL.extractName(url);
    if (mimeTypeByName.has(name)) {
      return mimeTypeByName.get(name);
    }
    const ext = ParsedURL.extractExtension(url).toLowerCase();
    return mimeTypeByExtension.get(ext);
  }
  static mimeFromExtension(ext) {
    return mimeTypeByExtension.get(ext);
  }
  name() {
    return this.#nameInternal;
  }
  title() {
    return this.#titleInternal();
  }
  category() {
    return this.#categoryInternal;
  }
  isTextType() {
    return this.#isTextTypeInternal;
  }
  isScript() {
    return this.#nameInternal === "script" || this.#nameInternal === "sm-script";
  }
  hasScripts() {
    return this.isScript() || this.isDocument();
  }
  isStyleSheet() {
    return this.#nameInternal === "stylesheet" || this.#nameInternal === "sm-stylesheet";
  }
  isDocument() {
    return this.#nameInternal === "document";
  }
  isDocumentOrScriptOrStyleSheet() {
    return this.isDocument() || this.isScript() || this.isStyleSheet();
  }
  isFont() {
    return this.#nameInternal === "font";
  }
  isImage() {
    return this.#nameInternal === "image";
  }
  isFromSourceMap() {
    return this.#nameInternal.startsWith("sm-");
  }
  isWebbundle() {
    return this.#nameInternal === "webbundle";
  }
  toString() {
    return this.#nameInternal;
  }
  canonicalMimeType() {
    if (this.isDocument()) {
      return "text/html";
    }
    if (this.isScript()) {
      return "text/javascript";
    }
    if (this.isStyleSheet()) {
      return "text/css";
    }
    return "";
  }
}
export class ResourceCategory {
  title;
  shortTitle;
  constructor(title, shortTitle) {
    this.title = title;
    this.shortTitle = shortTitle;
  }
}
export const resourceCategories = {
  XHR: new ResourceCategory(i18nLazyString(UIStrings.xhrAndFetch), i18n.i18n.lockedLazyString("Fetch/XHR")),
  Script: new ResourceCategory(i18nLazyString(UIStrings.scripts), i18nLazyString(UIStrings.js)),
  Stylesheet: new ResourceCategory(i18nLazyString(UIStrings.stylesheets), i18nLazyString(UIStrings.css)),
  Image: new ResourceCategory(i18nLazyString(UIStrings.images), i18nLazyString(UIStrings.img)),
  Media: new ResourceCategory(i18nLazyString(UIStrings.media), i18nLazyString(UIStrings.media)),
  Font: new ResourceCategory(i18nLazyString(UIStrings.fonts), i18nLazyString(UIStrings.font)),
  Document: new ResourceCategory(i18nLazyString(UIStrings.documents), i18nLazyString(UIStrings.doc)),
  WebSocket: new ResourceCategory(i18nLazyString(UIStrings.websockets), i18nLazyString(UIStrings.ws)),
  Wasm: new ResourceCategory(i18nLazyString(UIStrings.webassembly), i18nLazyString(UIStrings.wasm)),
  Manifest: new ResourceCategory(i18nLazyString(UIStrings.manifest), i18nLazyString(UIStrings.manifest)),
  Other: new ResourceCategory(i18nLazyString(UIStrings.other), i18nLazyString(UIStrings.other))
};
export const resourceTypes = {
  Document: new ResourceType("document", i18nLazyString(UIStrings.document), resourceCategories.Document, true),
  Stylesheet: new ResourceType("stylesheet", i18nLazyString(UIStrings.stylesheet), resourceCategories.Stylesheet, true),
  Image: new ResourceType("image", i18nLazyString(UIStrings.image), resourceCategories.Image, false),
  Media: new ResourceType("media", i18nLazyString(UIStrings.media), resourceCategories.Media, false),
  Font: new ResourceType("font", i18nLazyString(UIStrings.font), resourceCategories.Font, false),
  Script: new ResourceType("script", i18nLazyString(UIStrings.script), resourceCategories.Script, true),
  TextTrack: new ResourceType("texttrack", i18nLazyString(UIStrings.texttrack), resourceCategories.Other, true),
  XHR: new ResourceType("xhr", i18n.i18n.lockedLazyString("XHR"), resourceCategories.XHR, true),
  Fetch: new ResourceType("fetch", i18nLazyString(UIStrings.fetch), resourceCategories.XHR, true),
  EventSource: new ResourceType("eventsource", i18nLazyString(UIStrings.eventsource), resourceCategories.XHR, true),
  WebSocket: new ResourceType("websocket", i18nLazyString(UIStrings.websocket), resourceCategories.WebSocket, false),
  WebTransport: new ResourceType("webtransport", i18nLazyString(UIStrings.webtransport), resourceCategories.WebSocket, false),
  Wasm: new ResourceType("wasm", i18nLazyString(UIStrings.wasm), resourceCategories.Wasm, false),
  Manifest: new ResourceType("manifest", i18nLazyString(UIStrings.manifest), resourceCategories.Manifest, true),
  SignedExchange: new ResourceType("signed-exchange", i18nLazyString(UIStrings.signedexchange), resourceCategories.Other, false),
  Ping: new ResourceType("ping", i18nLazyString(UIStrings.ping), resourceCategories.Other, false),
  CSPViolationReport: new ResourceType("csp-violation-report", i18nLazyString(UIStrings.cspviolationreport), resourceCategories.Other, false),
  Other: new ResourceType("other", i18nLazyString(UIStrings.other), resourceCategories.Other, false),
  Preflight: new ResourceType("preflight", i18nLazyString(UIStrings.preflight), resourceCategories.Other, true),
  SourceMapScript: new ResourceType("sm-script", i18nLazyString(UIStrings.script), resourceCategories.Script, true),
  SourceMapStyleSheet: new ResourceType("sm-stylesheet", i18nLazyString(UIStrings.stylesheet), resourceCategories.Stylesheet, true),
  WebBundle: new ResourceType("webbundle", i18nLazyString(UIStrings.webbundle), resourceCategories.Other, false)
};
const mimeTypeByName = /* @__PURE__ */ new Map([
  ["Cakefile", "text/x-coffeescript"]
]);
export const resourceTypeByExtension = /* @__PURE__ */ new Map([
  ["js", resourceTypes.Script],
  ["mjs", resourceTypes.Script],
  ["css", resourceTypes.Stylesheet],
  ["xsl", resourceTypes.Stylesheet],
  ["avif", resourceTypes.Image],
  ["avifs", resourceTypes.Image],
  ["bmp", resourceTypes.Image],
  ["gif", resourceTypes.Image],
  ["ico", resourceTypes.Image],
  ["jpeg", resourceTypes.Image],
  ["jpg", resourceTypes.Image],
  ["jxl", resourceTypes.Image],
  ["png", resourceTypes.Image],
  ["svg", resourceTypes.Image],
  ["tif", resourceTypes.Image],
  ["tiff", resourceTypes.Image],
  ["webp", resourceTypes.Media],
  ["otf", resourceTypes.Font],
  ["ttc", resourceTypes.Font],
  ["ttf", resourceTypes.Font],
  ["woff", resourceTypes.Font],
  ["woff2", resourceTypes.Font],
  ["wasm", resourceTypes.Wasm]
]);
export const mimeTypeByExtension = /* @__PURE__ */ new Map([
  ["js", "text/javascript"],
  ["mjs", "text/javascript"],
  ["css", "text/css"],
  ["html", "text/html"],
  ["htm", "text/html"],
  ["xml", "application/xml"],
  ["xsl", "application/xml"],
  ["wasm", "application/wasm"],
  ["asp", "application/x-aspx"],
  ["aspx", "application/x-aspx"],
  ["jsp", "application/x-jsp"],
  ["c", "text/x-c++src"],
  ["cc", "text/x-c++src"],
  ["cpp", "text/x-c++src"],
  ["h", "text/x-c++src"],
  ["m", "text/x-c++src"],
  ["mm", "text/x-c++src"],
  ["coffee", "text/x-coffeescript"],
  ["dart", "text/javascript"],
  ["ts", "text/typescript"],
  ["tsx", "text/typescript-jsx"],
  ["json", "application/json"],
  ["gyp", "application/json"],
  ["gypi", "application/json"],
  ["cs", "text/x-csharp"],
  ["java", "text/x-java"],
  ["less", "text/x-less"],
  ["php", "text/x-php"],
  ["phtml", "application/x-httpd-php"],
  ["py", "text/x-python"],
  ["sh", "text/x-sh"],
  ["scss", "text/x-scss"],
  ["vtt", "text/vtt"],
  ["ls", "text/x-livescript"],
  ["md", "text/markdown"],
  ["cljs", "text/x-clojure"],
  ["cljc", "text/x-clojure"],
  ["cljx", "text/x-clojure"],
  ["styl", "text/x-styl"],
  ["jsx", "text/jsx"],
  ["avif", "image/avif"],
  ["avifs", "image/avif-sequence"],
  ["bmp", "image/bmp"],
  ["gif", "image/gif"],
  ["ico", "image/ico"],
  ["jpeg", "image/jpeg"],
  ["jpg", "image/jpeg"],
  ["jxl", "image/jxl"],
  ["png", "image/png"],
  ["svg", "image/svg+xml"],
  ["tif", "image/tif"],
  ["tiff", "image/tiff"],
  ["webp", "image/webp"],
  ["otf", "font/otf"],
  ["ttc", "font/collection"],
  ["ttf", "font/ttf"],
  ["woff", "font/woff"],
  ["woff2", "font/woff2"]
]);
//# sourceMappingURL=ResourceType.js.map
