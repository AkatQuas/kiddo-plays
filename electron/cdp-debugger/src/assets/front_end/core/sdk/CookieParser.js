import { Cookie, Type } from "./Cookie.js";
export class CookieParser {
  #domain;
  #cookiesInternal;
  #input;
  #originalInputLength;
  #lastCookie;
  #lastCookieLine;
  #lastCookiePosition;
  constructor(domain) {
    if (domain) {
      this.#domain = domain.toLowerCase().replace(/^\./, "");
    }
    this.#cookiesInternal = [];
    this.#originalInputLength = 0;
  }
  static parseSetCookie(header, domain) {
    return new CookieParser(domain).parseSetCookie(header);
  }
  cookies() {
    return this.#cookiesInternal;
  }
  parseSetCookie(setCookieHeader) {
    if (!this.initialize(setCookieHeader)) {
      return null;
    }
    for (let kv = this.extractKeyValue(); kv; kv = this.extractKeyValue()) {
      if (this.#lastCookie) {
        this.#lastCookie.addAttribute(kv.key, kv.value);
      } else {
        this.addCookie(kv, Type.Response);
      }
      if (this.advanceAndCheckCookieDelimiter()) {
        this.flushCookie();
      }
    }
    this.flushCookie();
    return this.#cookiesInternal;
  }
  initialize(headerValue) {
    this.#input = headerValue;
    if (typeof headerValue !== "string") {
      return false;
    }
    this.#cookiesInternal = [];
    this.#lastCookie = null;
    this.#lastCookieLine = "";
    this.#originalInputLength = this.#input.length;
    return true;
  }
  flushCookie() {
    if (this.#lastCookie) {
      this.#lastCookie.setSize(this.#originalInputLength - this.#input.length - this.#lastCookiePosition);
      this.#lastCookie.setCookieLine(this.#lastCookieLine.replace("\n", ""));
    }
    this.#lastCookie = null;
    this.#lastCookieLine = "";
  }
  extractKeyValue() {
    if (!this.#input || !this.#input.length) {
      return null;
    }
    const keyValueMatch = /^[ \t]*([^=;]+)[ \t]*(?:=[ \t]*([^;\n]*))?/.exec(this.#input);
    if (!keyValueMatch) {
      console.error("Failed parsing cookie header before: " + this.#input);
      return null;
    }
    const result = new KeyValue(keyValueMatch[1] && keyValueMatch[1].trim(), keyValueMatch[2] && keyValueMatch[2].trim(), this.#originalInputLength - this.#input.length);
    this.#lastCookieLine += keyValueMatch[0];
    this.#input = this.#input.slice(keyValueMatch[0].length);
    return result;
  }
  advanceAndCheckCookieDelimiter() {
    if (!this.#input) {
      return false;
    }
    const match = /^\s*[\n;]\s*/.exec(this.#input);
    if (!match) {
      return false;
    }
    this.#lastCookieLine += match[0];
    this.#input = this.#input.slice(match[0].length);
    return match[0].match("\n") !== null;
  }
  addCookie(keyValue, type) {
    if (this.#lastCookie) {
      this.#lastCookie.setSize(keyValue.position - this.#lastCookiePosition);
    }
    this.#lastCookie = typeof keyValue.value === "string" ? new Cookie(keyValue.key, keyValue.value, type) : new Cookie("", keyValue.key, type);
    if (this.#domain) {
      this.#lastCookie.addAttribute("domain", this.#domain);
    }
    this.#lastCookiePosition = keyValue.position;
    this.#cookiesInternal.push(this.#lastCookie);
  }
}
class KeyValue {
  key;
  value;
  position;
  constructor(key, value, position) {
    this.key = key;
    this.value = value;
    this.position = position;
  }
}
//# sourceMappingURL=CookieParser.js.map
