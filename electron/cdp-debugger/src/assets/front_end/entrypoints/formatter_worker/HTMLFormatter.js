import * as Platform from "../../core/platform/platform.js";
import { CSSFormatter } from "./CSSFormatter.js";
import { AbortTokenization, createTokenizer } from "./FormatterWorker.js";
import { JavaScriptFormatter } from "./JavaScriptFormatter.js";
export class HTMLFormatter {
  #builder;
  #jsFormatter;
  #cssFormatter;
  #text;
  #lineEndings;
  #model;
  constructor(builder) {
    this.#builder = builder;
    this.#jsFormatter = new JavaScriptFormatter(builder);
    this.#cssFormatter = new CSSFormatter(builder);
  }
  format(text, lineEndings) {
    this.#text = text;
    this.#lineEndings = lineEndings;
    this.#model = new HTMLModel(text);
    this.#walk(this.#model.document());
  }
  #formatTokensTill(element, offset) {
    if (!this.#model) {
      return;
    }
    let nextToken = this.#model.peekToken();
    while (nextToken && nextToken.startOffset < offset) {
      const token = this.#model.nextToken();
      this.#formatToken(element, token);
      nextToken = this.#model.peekToken();
    }
  }
  #walk(element) {
    if (!element.openTag || !element.closeTag) {
      throw new Error("Element is missing open or close tag");
    }
    if (element.parent) {
      this.#formatTokensTill(element.parent, element.openTag.startOffset);
    }
    this.#beforeOpenTag(element);
    this.#formatTokensTill(element, element.openTag.endOffset);
    this.#afterOpenTag(element);
    for (let i = 0; i < element.children.length; ++i) {
      this.#walk(element.children[i]);
    }
    this.#formatTokensTill(element, element.closeTag.startOffset);
    this.#beforeCloseTag(element);
    this.#formatTokensTill(element, element.closeTag.endOffset);
    this.#afterCloseTag(element);
  }
  #beforeOpenTag(element) {
    if (!this.#model) {
      return;
    }
    if (!element.children.length || element === this.#model.document()) {
      return;
    }
    this.#builder.addNewLine();
  }
  #afterOpenTag(element) {
    if (!this.#model) {
      return;
    }
    if (!element.children.length || element === this.#model.document()) {
      return;
    }
    this.#builder.increaseNestingLevel();
    this.#builder.addNewLine();
  }
  #beforeCloseTag(element) {
    if (!this.#model) {
      return;
    }
    if (!element.children.length || element === this.#model.document()) {
      return;
    }
    this.#builder.decreaseNestingLevel();
    this.#builder.addNewLine();
  }
  #afterCloseTag(_element) {
    this.#builder.addNewLine();
  }
  #formatToken(element, token) {
    if (Platform.StringUtilities.isWhitespace(token.value)) {
      return;
    }
    if (hasTokenInSet(token.type, "comment") || hasTokenInSet(token.type, "meta")) {
      this.#builder.addNewLine();
      this.#builder.addToken(token.value.trim(), token.startOffset);
      this.#builder.addNewLine();
      return;
    }
    if (!element.openTag || !element.closeTag) {
      return;
    }
    const isBodyToken = element.openTag.endOffset <= token.startOffset && token.startOffset < element.closeTag.startOffset;
    if (isBodyToken && element.name === "style") {
      this.#builder.addNewLine();
      this.#builder.increaseNestingLevel();
      this.#cssFormatter.format(this.#text || "", this.#lineEndings || [], token.startOffset, token.endOffset);
      this.#builder.decreaseNestingLevel();
      return;
    }
    if (isBodyToken && element.name === "script") {
      this.#builder.addNewLine();
      this.#builder.increaseNestingLevel();
      if (this.#scriptTagIsJavaScript(element)) {
        this.#jsFormatter.format(this.#text || "", this.#lineEndings || [], token.startOffset, token.endOffset);
      } else {
        this.#builder.addToken(token.value, token.startOffset);
        this.#builder.addNewLine();
      }
      this.#builder.decreaseNestingLevel();
      return;
    }
    if (!isBodyToken && hasTokenInSet(token.type, "attribute")) {
      this.#builder.addSoftSpace();
    }
    this.#builder.addToken(token.value, token.startOffset);
  }
  #scriptTagIsJavaScript(element) {
    if (!element.openTag) {
      return true;
    }
    if (!element.openTag.attributes.has("type")) {
      return true;
    }
    let type = element.openTag.attributes.get("type");
    if (!type) {
      return true;
    }
    type = type.toLowerCase();
    const isWrappedInQuotes = /^(["\'])(.*)\1$/.exec(type.trim());
    if (isWrappedInQuotes) {
      type = isWrappedInQuotes[2];
    }
    return HTMLFormatter.SupportedJavaScriptMimeTypes.has(type.trim());
  }
  static SupportedJavaScriptMimeTypes = /* @__PURE__ */ new Set([
    "application/ecmascript",
    "application/javascript",
    "application/x-ecmascript",
    "application/x-javascript",
    "text/ecmascript",
    "text/javascript",
    "text/javascript1.0",
    "text/javascript1.1",
    "text/javascript1.2",
    "text/javascript1.3",
    "text/javascript1.4",
    "text/javascript1.5",
    "text/jscript",
    "text/livescript",
    "text/x-ecmascript",
    "text/x-javascript"
  ]);
}
function hasTokenInSet(tokenTypes, type) {
  return tokenTypes.has(type) || tokenTypes.has(`xml-${type}`);
}
export class HTMLModel {
  #state;
  #documentInternal;
  #stack;
  #tokens;
  #tokenIndex;
  #attributes;
  #attributeName;
  #tagName;
  #isOpenTag;
  #tagStartOffset;
  #tagEndOffset;
  constructor(text) {
    this.#state = ParseState.Initial;
    this.#documentInternal = new FormatterElement("document");
    this.#documentInternal.openTag = new Tag("document", 0, 0, /* @__PURE__ */ new Map(), true, false);
    this.#documentInternal.closeTag = new Tag("document", text.length, text.length, /* @__PURE__ */ new Map(), false, false);
    this.#stack = [this.#documentInternal];
    this.#tokens = [];
    this.#tokenIndex = 0;
    this.#build(text);
    this.#attributes = /* @__PURE__ */ new Map();
    this.#attributeName = "";
    this.#tagName = "";
    this.#isOpenTag = false;
  }
  #build(text) {
    const tokenizer = createTokenizer("text/html");
    let lastOffset = 0;
    const lowerCaseText = text.toLowerCase();
    while (true) {
      tokenizer(text.substring(lastOffset), processToken.bind(this, lastOffset));
      if (lastOffset >= text.length) {
        break;
      }
      const element = this.#stack[this.#stack.length - 1];
      if (!element) {
        break;
      }
      lastOffset = lowerCaseText.indexOf("</" + element.name, lastOffset);
      if (lastOffset === -1) {
        lastOffset = text.length;
      }
      if (!element.openTag) {
        break;
      }
      const tokenStart = element.openTag.endOffset;
      const tokenEnd = lastOffset;
      const tokenValue = text.substring(tokenStart, tokenEnd);
      this.#tokens.push(new Token(tokenValue, /* @__PURE__ */ new Set(), tokenStart, tokenEnd));
    }
    while (this.#stack.length > 1) {
      const element = this.#stack[this.#stack.length - 1];
      if (!element) {
        break;
      }
      this.#popElement(new Tag(element.name, text.length, text.length, /* @__PURE__ */ new Map(), false, false));
    }
    function processToken(baseOffset, tokenValue, type, tokenStart, tokenEnd) {
      tokenStart += baseOffset;
      tokenEnd += baseOffset;
      lastOffset = tokenEnd;
      const tokenType = type ? new Set(type.split(" ")) : /* @__PURE__ */ new Set();
      const token = new Token(tokenValue, tokenType, tokenStart, tokenEnd);
      this.#tokens.push(token);
      this.#updateDOM(token);
      const element = this.#stack[this.#stack.length - 1];
      if (element && (element.name === "script" || element.name === "style") && element.openTag && element.openTag.endOffset === lastOffset) {
        return AbortTokenization;
      }
      return;
    }
  }
  #updateDOM(token) {
    const value = token.value;
    const type = token.type;
    switch (this.#state) {
      case ParseState.Initial:
        if (hasTokenInSet(type, "bracket") && (value === "<" || value === "</")) {
          this.#onStartTag(token);
          this.#state = ParseState.Tag;
        }
        return;
      case ParseState.Tag:
        if (hasTokenInSet(type, "tag") && !hasTokenInSet(type, "bracket")) {
          this.#tagName = value.trim().toLowerCase();
        } else if (hasTokenInSet(type, "attribute")) {
          this.#attributeName = value.trim().toLowerCase();
          this.#attributes.set(this.#attributeName, "");
          this.#state = ParseState.AttributeName;
        } else if (hasTokenInSet(type, "bracket") && (value === ">" || value === "/>")) {
          this.#onEndTag(token);
          this.#state = ParseState.Initial;
        }
        return;
      case ParseState.AttributeName:
        if (!type.size && value === "=") {
          this.#state = ParseState.AttributeValue;
        } else if (hasTokenInSet(type, "bracket") && (value === ">" || value === "/>")) {
          this.#onEndTag(token);
          this.#state = ParseState.Initial;
        }
        return;
      case ParseState.AttributeValue:
        if (hasTokenInSet(type, "string")) {
          this.#attributes.set(this.#attributeName, value);
          this.#state = ParseState.Tag;
        } else if (hasTokenInSet(type, "bracket") && (value === ">" || value === "/>")) {
          this.#onEndTag(token);
          this.#state = ParseState.Initial;
        }
        return;
    }
  }
  #onStartTag(token) {
    this.#tagName = "";
    this.#tagStartOffset = token.startOffset;
    this.#tagEndOffset = null;
    this.#attributes = /* @__PURE__ */ new Map();
    this.#attributeName = "";
    this.#isOpenTag = token.value === "<";
  }
  #onEndTag(token) {
    this.#tagEndOffset = token.endOffset;
    const selfClosingTag = token.value === "/>" || SelfClosingTags.has(this.#tagName);
    const tag = new Tag(this.#tagName, this.#tagStartOffset || 0, this.#tagEndOffset, this.#attributes, this.#isOpenTag, selfClosingTag);
    this.#onTagComplete(tag);
  }
  #onTagComplete(tag) {
    if (tag.isOpenTag) {
      const topElement = this.#stack[this.#stack.length - 1];
      if (topElement) {
        const tagSet = AutoClosingTags.get(topElement.name);
        if (topElement !== this.#documentInternal && topElement.openTag && topElement.openTag.selfClosingTag) {
          this.#popElement(autocloseTag(topElement, topElement.openTag.endOffset));
        } else if (tagSet && tagSet.has(tag.name)) {
          this.#popElement(autocloseTag(topElement, tag.startOffset));
        }
        this.#pushElement(tag);
      }
      return;
    }
    let lastTag = this.#stack[this.#stack.length - 1];
    while (this.#stack.length > 1 && lastTag && lastTag.name !== tag.name) {
      this.#popElement(autocloseTag(lastTag, tag.startOffset));
      lastTag = this.#stack[this.#stack.length - 1];
    }
    if (this.#stack.length === 1) {
      return;
    }
    this.#popElement(tag);
    function autocloseTag(element, offset) {
      return new Tag(element.name, offset, offset, /* @__PURE__ */ new Map(), false, false);
    }
  }
  #popElement(closeTag) {
    const element = this.#stack.pop();
    if (!element) {
      return;
    }
    element.closeTag = closeTag;
  }
  #pushElement(openTag) {
    const topElement = this.#stack[this.#stack.length - 1];
    const newElement = new FormatterElement(openTag.name);
    if (topElement) {
      newElement.parent = topElement;
      topElement.children.push(newElement);
    }
    newElement.openTag = openTag;
    this.#stack.push(newElement);
  }
  peekToken() {
    return this.#tokenIndex < this.#tokens.length ? this.#tokens[this.#tokenIndex] : null;
  }
  nextToken() {
    return this.#tokens[this.#tokenIndex++];
  }
  document() {
    return this.#documentInternal;
  }
}
const SelfClosingTags = /* @__PURE__ */ new Set([
  "area",
  "base",
  "br",
  "col",
  "command",
  "embed",
  "hr",
  "img",
  "input",
  "keygen",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);
const AutoClosingTags = /* @__PURE__ */ new Map([
  ["head", /* @__PURE__ */ new Set(["body"])],
  ["li", /* @__PURE__ */ new Set(["li"])],
  ["dt", /* @__PURE__ */ new Set(["dt", "dd"])],
  ["dd", /* @__PURE__ */ new Set(["dt", "dd"])],
  [
    "p",
    /* @__PURE__ */ new Set([
      "address",
      "article",
      "aside",
      "blockquote",
      "div",
      "dl",
      "fieldset",
      "footer",
      "form",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "header",
      "hgroup",
      "hr",
      "main",
      "nav",
      "ol",
      "p",
      "pre",
      "section",
      "table",
      "ul"
    ])
  ],
  ["rb", /* @__PURE__ */ new Set(["rb", "rt", "rtc", "rp"])],
  ["rt", /* @__PURE__ */ new Set(["rb", "rt", "rtc", "rp"])],
  ["rtc", /* @__PURE__ */ new Set(["rb", "rtc", "rp"])],
  ["rp", /* @__PURE__ */ new Set(["rb", "rt", "rtc", "rp"])],
  ["optgroup", /* @__PURE__ */ new Set(["optgroup"])],
  ["option", /* @__PURE__ */ new Set(["option", "optgroup"])],
  ["colgroup", /* @__PURE__ */ new Set(["colgroup"])],
  ["thead", /* @__PURE__ */ new Set(["tbody", "tfoot"])],
  ["tbody", /* @__PURE__ */ new Set(["tbody", "tfoot"])],
  ["tfoot", /* @__PURE__ */ new Set(["tbody"])],
  ["tr", /* @__PURE__ */ new Set(["tr"])],
  ["td", /* @__PURE__ */ new Set(["td", "th"])],
  ["th", /* @__PURE__ */ new Set(["td", "th"])]
]);
var ParseState = /* @__PURE__ */ ((ParseState2) => {
  ParseState2["Initial"] = "Initial";
  ParseState2["Tag"] = "Tag";
  ParseState2["AttributeName"] = "AttributeName";
  ParseState2["AttributeValue"] = "AttributeValue";
  return ParseState2;
})(ParseState || {});
class Token {
  value;
  type;
  startOffset;
  endOffset;
  constructor(value, type, startOffset, endOffset) {
    this.value = value;
    this.type = type;
    this.startOffset = startOffset;
    this.endOffset = endOffset;
  }
}
class Tag {
  name;
  startOffset;
  endOffset;
  attributes;
  isOpenTag;
  selfClosingTag;
  constructor(name, startOffset, endOffset, attributes, isOpenTag, selfClosingTag) {
    this.name = name;
    this.startOffset = startOffset;
    this.endOffset = endOffset;
    this.attributes = attributes;
    this.isOpenTag = isOpenTag;
    this.selfClosingTag = selfClosingTag;
  }
}
class FormatterElement {
  name;
  children = [];
  parent = null;
  openTag = null;
  closeTag = null;
  constructor(name) {
    this.name = name;
  }
}
//# sourceMappingURL=HTMLFormatter.js.map
