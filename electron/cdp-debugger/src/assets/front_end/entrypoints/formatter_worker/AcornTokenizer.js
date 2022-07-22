import * as Platform from "../../core/platform/platform.js";
import * as TextUtils from "../../models/text_utils/text_utils.js";
import * as Acorn from "../../third_party/acorn/acorn.js";
export class AcornTokenizer {
  #content;
  #comments;
  #tokenizer;
  #textCursor;
  #tokenLineStartInternal;
  #tokenLineEndInternal;
  #tokenColumnStartInternal;
  #bufferedToken;
  constructor(content) {
    this.#content = content;
    this.#comments = [];
    this.#tokenizer = Acorn.tokenizer(this.#content, { onComment: this.#comments, ecmaVersion: ECMA_VERSION, allowHashBang: true });
    const contentLineEndings = Platform.StringUtilities.findLineEndingIndexes(this.#content);
    this.#textCursor = new TextUtils.TextCursor.TextCursor(contentLineEndings);
    this.#tokenLineStartInternal = 0;
    this.#tokenLineEndInternal = 0;
    this.#tokenColumnStartInternal = 0;
    if (this.#comments.length === 0) {
      this.#nextTokenInternal();
    }
  }
  static punctuator(token, values) {
    return token.type !== Acorn.tokTypes.num && token.type !== Acorn.tokTypes.regexp && token.type !== Acorn.tokTypes.string && token.type !== Acorn.tokTypes.name && !token.type.keyword && (!values || token.type.label.length === 1 && values.indexOf(token.type.label) !== -1);
  }
  static keyword(token, keyword) {
    return Boolean(token.type.keyword) && token.type !== Acorn.tokTypes["_true"] && token.type !== Acorn.tokTypes["_false"] && token.type !== Acorn.tokTypes["_null"] && (!keyword || token.type.keyword === keyword);
  }
  static identifier(token, identifier) {
    return token.type === Acorn.tokTypes.name && (!identifier || token.value === identifier);
  }
  static lineComment(token) {
    return token.type === "Line";
  }
  static blockComment(token) {
    return token.type === "Block";
  }
  #nextTokenInternal() {
    if (this.#comments.length) {
      const nextComment = this.#comments.shift();
      if (!this.#bufferedToken && this.#comments.length === 0) {
        this.#bufferedToken = this.#tokenizer.getToken();
      }
      return nextComment;
    }
    const token = this.#bufferedToken;
    this.#bufferedToken = this.#tokenizer.getToken();
    return token;
  }
  nextToken() {
    const token = this.#nextTokenInternal();
    if (!token || token.type === Acorn.tokTypes.eof) {
      return null;
    }
    this.#textCursor.advance(token.start);
    this.#tokenLineStartInternal = this.#textCursor.lineNumber();
    this.#tokenColumnStartInternal = this.#textCursor.columnNumber();
    this.#textCursor.advance(token.end);
    this.#tokenLineEndInternal = this.#textCursor.lineNumber();
    return token;
  }
  peekToken() {
    if (this.#comments.length) {
      return this.#comments[0];
    }
    if (!this.#bufferedToken) {
      return null;
    }
    return this.#bufferedToken.type !== Acorn.tokTypes.eof ? this.#bufferedToken : null;
  }
  tokenLineStart() {
    return this.#tokenLineStartInternal;
  }
  tokenLineEnd() {
    return this.#tokenLineEndInternal;
  }
  tokenColumnStart() {
    return this.#tokenColumnStartInternal;
  }
}
export const ECMA_VERSION = 2022;
//# sourceMappingURL=AcornTokenizer.js.map
