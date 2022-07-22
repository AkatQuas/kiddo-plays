export var ResultKind = /* @__PURE__ */ ((ResultKind2) => {
  ResultKind2[ResultKind2["ERROR"] = 0] = "ERROR";
  ResultKind2[ResultKind2["PARAM_NAME"] = 1] = "PARAM_NAME";
  ResultKind2[ResultKind2["PARAMETER"] = 2] = "PARAMETER";
  ResultKind2[ResultKind2["PARAMETERS"] = 3] = "PARAMETERS";
  ResultKind2[ResultKind2["ITEM"] = 4] = "ITEM";
  ResultKind2[ResultKind2["INTEGER"] = 5] = "INTEGER";
  ResultKind2[ResultKind2["DECIMAL"] = 6] = "DECIMAL";
  ResultKind2[ResultKind2["STRING"] = 7] = "STRING";
  ResultKind2[ResultKind2["TOKEN"] = 8] = "TOKEN";
  ResultKind2[ResultKind2["BINARY"] = 9] = "BINARY";
  ResultKind2[ResultKind2["BOOLEAN"] = 10] = "BOOLEAN";
  ResultKind2[ResultKind2["LIST"] = 11] = "LIST";
  ResultKind2[ResultKind2["INNER_LIST"] = 12] = "INNER_LIST";
  ResultKind2[ResultKind2["SERIALIZATION_RESULT"] = 13] = "SERIALIZATION_RESULT";
  return ResultKind2;
})(ResultKind || {});
const CHAR_MINUS = "-".charCodeAt(0);
const CHAR_0 = "0".charCodeAt(0);
const CHAR_9 = "9".charCodeAt(0);
const CHAR_A = "A".charCodeAt(0);
const CHAR_Z = "Z".charCodeAt(0);
const CHAR_LOWER_A = "a".charCodeAt(0);
const CHAR_LOWER_Z = "z".charCodeAt(0);
const CHAR_DQUOTE = '"'.charCodeAt(0);
const CHAR_COLON = ":".charCodeAt(0);
const CHAR_QUESTION_MARK = "?".charCodeAt(0);
const CHAR_STAR = "*".charCodeAt(0);
const CHAR_UNDERSCORE = "_".charCodeAt(0);
const CHAR_DOT = ".".charCodeAt(0);
const CHAR_BACKSLASH = "\\".charCodeAt(0);
const CHAR_SLASH = "/".charCodeAt(0);
const CHAR_PLUS = "+".charCodeAt(0);
const CHAR_EQUALS = "=".charCodeAt(0);
const CHAR_EXCLAMATION = "!".charCodeAt(0);
const CHAR_HASH = "#".charCodeAt(0);
const CHAR_DOLLAR = "$".charCodeAt(0);
const CHAR_PERCENT = "%".charCodeAt(0);
const CHAR_AND = "&".charCodeAt(0);
const CHAR_SQUOTE = "'".charCodeAt(0);
const CHAR_HAT = "^".charCodeAt(0);
const CHAR_BACKTICK = "`".charCodeAt(0);
const CHAR_PIPE = "|".charCodeAt(0);
const CHAR_TILDE = "~".charCodeAt(0);
const CHAR_MIN_ASCII_PRINTABLE = 32;
const CHAR_MAX_ASCII_PRINTABLE = 126;
function isDigit(charCode) {
  if (charCode === void 0) {
    return false;
  }
  return charCode >= CHAR_0 && charCode <= CHAR_9;
}
function isAlpha(charCode) {
  if (charCode === void 0) {
    return false;
  }
  return charCode >= CHAR_A && charCode <= CHAR_Z || charCode >= CHAR_LOWER_A && charCode <= CHAR_LOWER_Z;
}
function isLcAlpha(charCode) {
  if (charCode === void 0) {
    return false;
  }
  return charCode >= CHAR_LOWER_A && charCode <= CHAR_LOWER_Z;
}
function isTChar(charCode) {
  if (charCode === void 0) {
    return false;
  }
  if (isDigit(charCode) || isAlpha(charCode)) {
    return true;
  }
  switch (charCode) {
    case CHAR_EXCLAMATION:
    case CHAR_HASH:
    case CHAR_DOLLAR:
    case CHAR_PERCENT:
    case CHAR_AND:
    case CHAR_SQUOTE:
    case CHAR_STAR:
    case CHAR_PLUS:
    case CHAR_MINUS:
    case CHAR_DOT:
    case CHAR_HAT:
    case CHAR_UNDERSCORE:
    case CHAR_BACKTICK:
    case CHAR_PIPE:
    case CHAR_TILDE:
      return true;
    default:
      return false;
  }
}
class Input {
  data;
  pos;
  constructor(input) {
    this.data = input;
    this.pos = 0;
    this.skipSP();
  }
  peek() {
    return this.data[this.pos];
  }
  peekCharCode() {
    return this.pos < this.data.length ? this.data.charCodeAt(this.pos) : void 0;
  }
  eat() {
    ++this.pos;
  }
  skipSP() {
    while (this.data[this.pos] === " ") {
      ++this.pos;
    }
  }
  skipOWS() {
    while (this.data[this.pos] === " " || this.data[this.pos] === "	") {
      ++this.pos;
    }
  }
  atEnd() {
    return this.pos === this.data.length;
  }
  allParsed() {
    this.skipSP();
    return this.pos === this.data.length;
  }
}
function makeError() {
  return { kind: 0 /* ERROR */ };
}
function parseListInternal(input) {
  const result = { kind: 11 /* LIST */, items: [] };
  while (!input.atEnd()) {
    const piece = parseItemOrInnerList(input);
    if (piece.kind === 0 /* ERROR */) {
      return piece;
    }
    result.items.push(piece);
    input.skipOWS();
    if (input.atEnd()) {
      return result;
    }
    if (input.peek() !== ",") {
      return makeError();
    }
    input.eat();
    input.skipOWS();
    if (input.atEnd()) {
      return makeError();
    }
  }
  return result;
}
function parseItemOrInnerList(input) {
  if (input.peek() === "(") {
    return parseInnerList(input);
  }
  return parseItemInternal(input);
}
function parseInnerList(input) {
  if (input.peek() !== "(") {
    return makeError();
  }
  input.eat();
  const items = [];
  while (!input.atEnd()) {
    input.skipSP();
    if (input.peek() === ")") {
      input.eat();
      const params = parseParameters(input);
      if (params.kind === 0 /* ERROR */) {
        return params;
      }
      return {
        kind: 12 /* INNER_LIST */,
        items,
        parameters: params
      };
    }
    const item = parseItemInternal(input);
    if (item.kind === 0 /* ERROR */) {
      return item;
    }
    items.push(item);
    if (input.peek() !== " " && input.peek() !== ")") {
      return makeError();
    }
  }
  return makeError();
}
function parseItemInternal(input) {
  const bareItem = parseBareItem(input);
  if (bareItem.kind === 0 /* ERROR */) {
    return bareItem;
  }
  const params = parseParameters(input);
  if (params.kind === 0 /* ERROR */) {
    return params;
  }
  return { kind: 4 /* ITEM */, value: bareItem, parameters: params };
}
function parseBareItem(input) {
  const upcoming = input.peekCharCode();
  if (upcoming === CHAR_MINUS || isDigit(upcoming)) {
    return parseIntegerOrDecimal(input);
  }
  if (upcoming === CHAR_DQUOTE) {
    return parseString(input);
  }
  if (upcoming === CHAR_COLON) {
    return parseByteSequence(input);
  }
  if (upcoming === CHAR_QUESTION_MARK) {
    return parseBoolean(input);
  }
  if (upcoming === CHAR_STAR || isAlpha(upcoming)) {
    return parseToken(input);
  }
  return makeError();
}
function parseParameters(input) {
  const items = /* @__PURE__ */ new Map();
  while (!input.atEnd()) {
    if (input.peek() !== ";") {
      break;
    }
    input.eat();
    input.skipSP();
    const paramName = parseKey(input);
    if (paramName.kind === 0 /* ERROR */) {
      return paramName;
    }
    let paramValue = { kind: 10 /* BOOLEAN */, value: true };
    if (input.peek() === "=") {
      input.eat();
      const parsedParamValue = parseBareItem(input);
      if (parsedParamValue.kind === 0 /* ERROR */) {
        return parsedParamValue;
      }
      paramValue = parsedParamValue;
    }
    if (items.has(paramName.value)) {
      items.delete(paramName.value);
    }
    items.set(paramName.value, { kind: 2 /* PARAMETER */, name: paramName, value: paramValue });
  }
  return { kind: 3 /* PARAMETERS */, items: [...items.values()] };
}
function parseKey(input) {
  let outputString = "";
  const first = input.peekCharCode();
  if (first !== CHAR_STAR && !isLcAlpha(first)) {
    return makeError();
  }
  while (!input.atEnd()) {
    const upcoming = input.peekCharCode();
    if (!isLcAlpha(upcoming) && !isDigit(upcoming) && upcoming !== CHAR_UNDERSCORE && upcoming !== CHAR_MINUS && upcoming !== CHAR_DOT && upcoming !== CHAR_STAR) {
      break;
    }
    outputString += input.peek();
    input.eat();
  }
  return { kind: 1 /* PARAM_NAME */, value: outputString };
}
function parseIntegerOrDecimal(input) {
  let resultKind = 5 /* INTEGER */;
  let sign = 1;
  let inputNumber = "";
  if (input.peek() === "-") {
    input.eat();
    sign = -1;
  }
  if (!isDigit(input.peekCharCode())) {
    return makeError();
  }
  while (!input.atEnd()) {
    const char = input.peekCharCode();
    if (char !== void 0 && isDigit(char)) {
      input.eat();
      inputNumber += String.fromCodePoint(char);
    } else if (char === CHAR_DOT && resultKind === 5 /* INTEGER */) {
      input.eat();
      if (inputNumber.length > 12) {
        return makeError();
      }
      inputNumber += ".";
      resultKind = 6 /* DECIMAL */;
    } else {
      break;
    }
    if (resultKind === 5 /* INTEGER */ && inputNumber.length > 15) {
      return makeError();
    }
    if (resultKind === 6 /* DECIMAL */ && inputNumber.length > 16) {
      return makeError();
    }
  }
  if (resultKind === 5 /* INTEGER */) {
    const num = sign * Number.parseInt(inputNumber, 10);
    if (num < -999999999999999 || num > 999999999999999) {
      return makeError();
    }
    return { kind: 5 /* INTEGER */, value: num };
  }
  const afterDot = inputNumber.length - 1 - inputNumber.indexOf(".");
  if (afterDot > 3 || afterDot === 0) {
    return makeError();
  }
  return { kind: 6 /* DECIMAL */, value: sign * Number.parseFloat(inputNumber) };
}
function parseString(input) {
  let outputString = "";
  if (input.peek() !== '"') {
    return makeError();
  }
  input.eat();
  while (!input.atEnd()) {
    const char = input.peekCharCode();
    if (char === void 0) {
      return makeError();
    }
    input.eat();
    if (char === CHAR_BACKSLASH) {
      if (input.atEnd()) {
        return makeError();
      }
      const nextChar = input.peekCharCode();
      input.eat();
      if (nextChar !== CHAR_BACKSLASH && nextChar !== CHAR_DQUOTE) {
        return makeError();
      }
      outputString += String.fromCodePoint(nextChar);
    } else if (char === CHAR_DQUOTE) {
      return { kind: 7 /* STRING */, value: outputString };
    } else if (char < CHAR_MIN_ASCII_PRINTABLE || char > CHAR_MAX_ASCII_PRINTABLE) {
      return makeError();
    } else {
      outputString += String.fromCodePoint(char);
    }
  }
  return makeError();
}
function parseToken(input) {
  const first = input.peekCharCode();
  if (first !== CHAR_STAR && !isAlpha(first)) {
    return makeError();
  }
  let outputString = "";
  while (!input.atEnd()) {
    const upcoming = input.peekCharCode();
    if (upcoming === void 0 || !isTChar(upcoming) && upcoming !== CHAR_COLON && upcoming !== CHAR_SLASH) {
      break;
    }
    input.eat();
    outputString += String.fromCodePoint(upcoming);
  }
  return { kind: 8 /* TOKEN */, value: outputString };
}
function parseByteSequence(input) {
  let outputString = "";
  if (input.peek() !== ":") {
    return makeError();
  }
  input.eat();
  while (!input.atEnd()) {
    const char = input.peekCharCode();
    if (char === void 0) {
      return makeError();
    }
    input.eat();
    if (char === CHAR_COLON) {
      return { kind: 9 /* BINARY */, value: outputString };
    }
    if (isDigit(char) || isAlpha(char) || char === CHAR_PLUS || char === CHAR_SLASH || char === CHAR_EQUALS) {
      outputString += String.fromCodePoint(char);
    } else {
      return makeError();
    }
  }
  return makeError();
}
function parseBoolean(input) {
  if (input.peek() !== "?") {
    return makeError();
  }
  input.eat();
  if (input.peek() === "0") {
    input.eat();
    return { kind: 10 /* BOOLEAN */, value: false };
  }
  if (input.peek() === "1") {
    input.eat();
    return { kind: 10 /* BOOLEAN */, value: true };
  }
  return makeError();
}
export function parseItem(input) {
  const i = new Input(input);
  const result = parseItemInternal(i);
  if (!i.allParsed()) {
    return makeError();
  }
  return result;
}
export function parseList(input) {
  return parseListInternal(new Input(input));
}
export function serializeItem(input) {
  const bareItemVal = serializeBareItem(input.value);
  if (bareItemVal.kind === 0 /* ERROR */) {
    return bareItemVal;
  }
  const paramVal = serializeParameters(input.parameters);
  if (paramVal.kind === 0 /* ERROR */) {
    return paramVal;
  }
  return { kind: 13 /* SERIALIZATION_RESULT */, value: bareItemVal.value + paramVal.value };
}
export function serializeList(input) {
  const outputPieces = [];
  for (let i = 0; i < input.items.length; ++i) {
    const item = input.items[i];
    if (item.kind === 12 /* INNER_LIST */) {
      const itemResult = serializeInnerList(item);
      if (itemResult.kind === 0 /* ERROR */) {
        return itemResult;
      }
      outputPieces.push(itemResult.value);
    } else {
      const itemResult = serializeItem(item);
      if (itemResult.kind === 0 /* ERROR */) {
        return itemResult;
      }
      outputPieces.push(itemResult.value);
    }
  }
  const output = outputPieces.join(", ");
  return { kind: 13 /* SERIALIZATION_RESULT */, value: output };
}
function serializeInnerList(input) {
  const outputPieces = [];
  for (let i = 0; i < input.items.length; ++i) {
    const itemResult = serializeItem(input.items[i]);
    if (itemResult.kind === 0 /* ERROR */) {
      return itemResult;
    }
    outputPieces.push(itemResult.value);
  }
  let output = "(" + outputPieces.join(" ") + ")";
  const paramResult = serializeParameters(input.parameters);
  if (paramResult.kind === 0 /* ERROR */) {
    return paramResult;
  }
  output += paramResult.value;
  return { kind: 13 /* SERIALIZATION_RESULT */, value: output };
}
function serializeParameters(input) {
  let output = "";
  for (const item of input.items) {
    output += ";";
    const nameResult = serializeKey(item.name);
    if (nameResult.kind === 0 /* ERROR */) {
      return nameResult;
    }
    output += nameResult.value;
    const itemVal = item.value;
    if (itemVal.kind !== 10 /* BOOLEAN */ || !itemVal.value) {
      output += "=";
      const itemValResult = serializeBareItem(itemVal);
      if (itemValResult.kind === 0 /* ERROR */) {
        return itemValResult;
      }
      output += itemValResult.value;
    }
  }
  return { kind: 13 /* SERIALIZATION_RESULT */, value: output };
}
function serializeKey(input) {
  if (input.value.length === 0) {
    return makeError();
  }
  const firstChar = input.value.charCodeAt(0);
  if (!isLcAlpha(firstChar) && firstChar !== CHAR_STAR) {
    return makeError();
  }
  for (let i = 1; i < input.value.length; ++i) {
    const char = input.value.charCodeAt(i);
    if (!isLcAlpha(char) && !isDigit(char) && char !== CHAR_UNDERSCORE && char !== CHAR_MINUS && char !== CHAR_DOT && char !== CHAR_STAR) {
      return makeError();
    }
  }
  return { kind: 13 /* SERIALIZATION_RESULT */, value: input.value };
}
function serializeBareItem(input) {
  if (input.kind === 5 /* INTEGER */) {
    return serializeInteger(input);
  }
  if (input.kind === 6 /* DECIMAL */) {
    return serializeDecimal(input);
  }
  if (input.kind === 7 /* STRING */) {
    return serializeString(input);
  }
  if (input.kind === 8 /* TOKEN */) {
    return serializeToken(input);
  }
  if (input.kind === 10 /* BOOLEAN */) {
    return serializeBoolean(input);
  }
  if (input.kind === 9 /* BINARY */) {
    return serializeByteSequence(input);
  }
  return makeError();
}
function serializeInteger(input) {
  if (input.value < -999999999999999 || input.value > 999999999999999 || !Number.isInteger(input.value)) {
    return makeError();
  }
  return { kind: 13 /* SERIALIZATION_RESULT */, value: input.value.toString(10) };
}
function serializeDecimal(_input) {
  throw "Unimplemented";
}
function serializeString(input) {
  for (let i = 0; i < input.value.length; ++i) {
    const char = input.value.charCodeAt(i);
    if (char < CHAR_MIN_ASCII_PRINTABLE || char > CHAR_MAX_ASCII_PRINTABLE) {
      return makeError();
    }
  }
  let output = '"';
  for (let i = 0; i < input.value.length; ++i) {
    const charStr = input.value[i];
    if (charStr === '"' || charStr === "\\") {
      output += "\\";
    }
    output += charStr;
  }
  output += '"';
  return { kind: 13 /* SERIALIZATION_RESULT */, value: output };
}
function serializeToken(input) {
  if (input.value.length === 0) {
    return makeError();
  }
  const firstChar = input.value.charCodeAt(0);
  if (!isAlpha(firstChar) && firstChar !== CHAR_STAR) {
    return makeError();
  }
  for (let i = 1; i < input.value.length; ++i) {
    const char = input.value.charCodeAt(i);
    if (!isTChar(char) && char !== CHAR_COLON && char !== CHAR_SLASH) {
      return makeError();
    }
  }
  return { kind: 13 /* SERIALIZATION_RESULT */, value: input.value };
}
function serializeByteSequence(_input) {
  throw "Unimplemented";
}
function serializeBoolean(input) {
  return { kind: 13 /* SERIALIZATION_RESULT */, value: input.value ? "?1" : "?0" };
}
//# sourceMappingURL=StructuredHeaders.js.map
