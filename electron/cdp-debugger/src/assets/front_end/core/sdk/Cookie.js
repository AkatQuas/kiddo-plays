const OPAQUE_PARITION_KEY = "<opaque>";
export class Cookie {
  #nameInternal;
  #valueInternal;
  #typeInternal;
  #attributes;
  #sizeInternal;
  #priorityInternal;
  #cookieLine;
  constructor(name, value, type, priority) {
    this.#nameInternal = name;
    this.#valueInternal = value;
    this.#typeInternal = type;
    this.#attributes = {};
    this.#sizeInternal = 0;
    this.#priorityInternal = priority || "Medium";
    this.#cookieLine = null;
  }
  static fromProtocolCookie(protocolCookie) {
    const cookie = new Cookie(protocolCookie.name, protocolCookie.value, null, protocolCookie.priority);
    cookie.addAttribute("domain", protocolCookie["domain"]);
    cookie.addAttribute("path", protocolCookie["path"]);
    if (protocolCookie["expires"]) {
      cookie.addAttribute("expires", protocolCookie["expires"] * 1e3);
    }
    if (protocolCookie["httpOnly"]) {
      cookie.addAttribute("httpOnly");
    }
    if (protocolCookie["secure"]) {
      cookie.addAttribute("secure");
    }
    if (protocolCookie["sameSite"]) {
      cookie.addAttribute("sameSite", protocolCookie["sameSite"]);
    }
    if (protocolCookie.sameParty) {
      cookie.addAttribute("sameParty");
    }
    if ("sourcePort" in protocolCookie) {
      cookie.addAttribute("sourcePort", protocolCookie.sourcePort);
    }
    if ("sourceScheme" in protocolCookie) {
      cookie.addAttribute("sourceScheme", protocolCookie.sourceScheme);
    }
    if ("partitionKey" in protocolCookie) {
      cookie.addAttribute("partitionKey", protocolCookie.partitionKey);
    }
    if ("partitionKeyOpaque" in protocolCookie) {
      cookie.addAttribute("partitionKey", OPAQUE_PARITION_KEY);
    }
    cookie.setSize(protocolCookie["size"]);
    return cookie;
  }
  key() {
    return (this.domain() || "-") + " " + this.name() + " " + (this.path() || "-");
  }
  name() {
    return this.#nameInternal;
  }
  value() {
    return this.#valueInternal;
  }
  type() {
    return this.#typeInternal;
  }
  httpOnly() {
    return "httponly" in this.#attributes;
  }
  secure() {
    return "secure" in this.#attributes;
  }
  sameSite() {
    return this.#attributes["samesite"];
  }
  sameParty() {
    return "sameparty" in this.#attributes;
  }
  partitionKey() {
    return this.#attributes["partitionkey"];
  }
  partitionKeyOpaque() {
    return this.#attributes["partitionkey"] === OPAQUE_PARITION_KEY;
  }
  priority() {
    return this.#priorityInternal;
  }
  session() {
    return !("expires" in this.#attributes || "max-age" in this.#attributes);
  }
  path() {
    return this.#attributes["path"];
  }
  domain() {
    return this.#attributes["domain"];
  }
  expires() {
    return this.#attributes["expires"];
  }
  maxAge() {
    return this.#attributes["max-age"];
  }
  sourcePort() {
    return this.#attributes["sourceport"];
  }
  sourceScheme() {
    return this.#attributes["sourcescheme"];
  }
  size() {
    return this.#sizeInternal;
  }
  url() {
    if (!this.domain() || !this.path()) {
      return null;
    }
    let port = "";
    const sourcePort = this.sourcePort();
    if (sourcePort && sourcePort !== 80 && sourcePort !== 443) {
      port = `:${this.sourcePort()}`;
    }
    return (this.secure() ? "https://" : "http://") + this.domain() + port + this.path();
  }
  setSize(size) {
    this.#sizeInternal = size;
  }
  expiresDate(requestDate) {
    if (this.maxAge()) {
      return new Date(requestDate.getTime() + 1e3 * this.maxAge());
    }
    if (this.expires()) {
      return new Date(this.expires());
    }
    return null;
  }
  addAttribute(key, value) {
    const normalizedKey = key.toLowerCase();
    switch (normalizedKey) {
      case "priority":
        this.#priorityInternal = value;
        break;
      default:
        this.#attributes[normalizedKey] = value;
    }
  }
  setCookieLine(cookieLine) {
    this.#cookieLine = cookieLine;
  }
  getCookieLine() {
    return this.#cookieLine;
  }
  matchesSecurityOrigin(securityOrigin) {
    const hostname = new URL(securityOrigin).hostname;
    return Cookie.isDomainMatch(this.domain(), hostname);
  }
  static isDomainMatch(domain, hostname) {
    if (hostname === domain) {
      return true;
    }
    if (!domain || domain[0] !== ".") {
      return false;
    }
    if (domain.substr(1) === hostname) {
      return true;
    }
    return hostname.length > domain.length && hostname.endsWith(domain);
  }
}
export var Type = /* @__PURE__ */ ((Type2) => {
  Type2[Type2["Request"] = 0] = "Request";
  Type2[Type2["Response"] = 1] = "Response";
  return Type2;
})(Type || {});
export var Attributes = /* @__PURE__ */ ((Attributes2) => {
  Attributes2["Name"] = "name";
  Attributes2["Value"] = "value";
  Attributes2["Size"] = "size";
  Attributes2["Domain"] = "domain";
  Attributes2["Path"] = "path";
  Attributes2["Expires"] = "expires";
  Attributes2["HttpOnly"] = "httpOnly";
  Attributes2["Secure"] = "secure";
  Attributes2["SameSite"] = "sameSite";
  Attributes2["SameParty"] = "sameParty";
  Attributes2["SourceScheme"] = "sourceScheme";
  Attributes2["SourcePort"] = "sourcePort";
  Attributes2["Priority"] = "priority";
  Attributes2["PartitionKey"] = "partitionKey";
  return Attributes2;
})(Attributes || {});
//# sourceMappingURL=Cookie.js.map
