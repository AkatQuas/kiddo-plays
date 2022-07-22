import * as Platform from "../../core/platform/platform.js";
import { SearchMatch } from "./ContentProvider.js";
import { Text } from "./Text.js";
export const Utils = {
  get _keyValueFilterRegex() {
    return /(?:^|\s)(\-)?([\w\-]+):([^\s]+)/;
  },
  get _regexFilterRegex() {
    return /(?:^|\s)(\-)?\/([^\s]+)\//;
  },
  get _textFilterRegex() {
    return /(?:^|\s)(\-)?([^\s]+)/;
  },
  get _SpaceCharRegex() {
    return /\s/;
  },
  get Indent() {
    return { TwoSpaces: "  ", FourSpaces: "    ", EightSpaces: "        ", TabCharacter: "	" };
  },
  isStopChar: function(char) {
    return char > " " && char < "0" || char > "9" && char < "A" || char > "Z" && char < "_" || char > "_" && char < "a" || char > "z" && char <= "~";
  },
  isWordChar: function(char) {
    return !Utils.isStopChar(char) && !Utils.isSpaceChar(char);
  },
  isSpaceChar: function(char) {
    return Utils._SpaceCharRegex.test(char);
  },
  isWord: function(word) {
    for (let i = 0; i < word.length; ++i) {
      if (!Utils.isWordChar(word.charAt(i))) {
        return false;
      }
    }
    return true;
  },
  isOpeningBraceChar: function(char) {
    return char === "(" || char === "{";
  },
  isClosingBraceChar: function(char) {
    return char === ")" || char === "}";
  },
  isBraceChar: function(char) {
    return Utils.isOpeningBraceChar(char) || Utils.isClosingBraceChar(char);
  },
  textToWords: function(text, isWordChar, wordCallback) {
    let startWord = -1;
    for (let i = 0; i < text.length; ++i) {
      if (!isWordChar(text.charAt(i))) {
        if (startWord !== -1) {
          wordCallback(text.substring(startWord, i));
        }
        startWord = -1;
      } else if (startWord === -1) {
        startWord = i;
      }
    }
    if (startWord !== -1) {
      wordCallback(text.substring(startWord));
    }
  },
  lineIndent: function(line) {
    let indentation = 0;
    while (indentation < line.length && Utils.isSpaceChar(line.charAt(indentation))) {
      ++indentation;
    }
    return line.substr(0, indentation);
  },
  isUpperCase: function(text) {
    return text === text.toUpperCase();
  },
  isLowerCase: function(text) {
    return text === text.toLowerCase();
  },
  splitStringByRegexes(text, regexes) {
    const matches = [];
    const globalRegexes = [];
    for (let i = 0; i < regexes.length; i++) {
      const regex = regexes[i];
      if (!regex.global) {
        globalRegexes.push(new RegExp(regex.source, regex.flags ? regex.flags + "g" : "g"));
      } else {
        globalRegexes.push(regex);
      }
    }
    doSplit(text, 0, 0);
    return matches;
    function doSplit(text2, regexIndex, startIndex) {
      if (regexIndex >= globalRegexes.length) {
        matches.push({ value: text2, position: startIndex, regexIndex: -1, captureGroups: [] });
        return;
      }
      const regex = globalRegexes[regexIndex];
      let currentIndex = 0;
      let result;
      regex.lastIndex = 0;
      while ((result = regex.exec(text2)) !== null) {
        const stringBeforeMatch = text2.substring(currentIndex, result.index);
        if (stringBeforeMatch) {
          doSplit(stringBeforeMatch, regexIndex + 1, startIndex + currentIndex);
        }
        const match = result[0];
        matches.push({
          value: match,
          position: startIndex + result.index,
          regexIndex,
          captureGroups: result.slice(1)
        });
        currentIndex = result.index + match.length;
      }
      const stringAfterMatches = text2.substring(currentIndex);
      if (stringAfterMatches) {
        doSplit(stringAfterMatches, regexIndex + 1, startIndex + currentIndex);
      }
    }
  }
};
export class FilterParser {
  keys;
  constructor(keys) {
    this.keys = keys;
  }
  static cloneFilter(filter) {
    return { key: filter.key, text: filter.text, regex: filter.regex, negative: filter.negative };
  }
  parse(query) {
    const splitFilters = Utils.splitStringByRegexes(query, [Utils._keyValueFilterRegex, Utils._regexFilterRegex, Utils._textFilterRegex]);
    const parsedFilters = [];
    for (const { regexIndex, captureGroups } of splitFilters) {
      if (regexIndex === -1) {
        continue;
      }
      if (regexIndex === 0) {
        const startsWithMinus = captureGroups[0];
        const parsedKey = captureGroups[1];
        const parsedValue = captureGroups[2];
        if (this.keys.indexOf(parsedKey) !== -1) {
          parsedFilters.push({
            key: parsedKey,
            regex: void 0,
            text: parsedValue,
            negative: Boolean(startsWithMinus)
          });
        } else {
          parsedFilters.push({
            key: void 0,
            regex: void 0,
            text: `${parsedKey}:${parsedValue}`,
            negative: Boolean(startsWithMinus)
          });
        }
      } else if (regexIndex === 1) {
        const startsWithMinus = captureGroups[0];
        const parsedRegex = captureGroups[1];
        try {
          parsedFilters.push({
            key: void 0,
            regex: new RegExp(parsedRegex, "i"),
            text: void 0,
            negative: Boolean(startsWithMinus)
          });
        } catch (e) {
          parsedFilters.push({
            key: void 0,
            regex: void 0,
            text: `/${parsedRegex}/`,
            negative: Boolean(startsWithMinus)
          });
        }
      } else if (regexIndex === 2) {
        const startsWithMinus = captureGroups[0];
        const parsedText = captureGroups[1];
        parsedFilters.push({
          key: void 0,
          regex: void 0,
          text: parsedText,
          negative: Boolean(startsWithMinus)
        });
      }
    }
    return parsedFilters;
  }
}
export class BalancedJSONTokenizer {
  callback;
  index;
  balance;
  buffer;
  findMultiple;
  closingDoubleQuoteRegex;
  lastBalancedIndex;
  constructor(callback, findMultiple) {
    this.callback = callback;
    this.index = 0;
    this.balance = 0;
    this.buffer = "";
    this.findMultiple = findMultiple || false;
    this.closingDoubleQuoteRegex = /[^\\](?:\\\\)*"/g;
  }
  write(chunk) {
    this.buffer += chunk;
    const lastIndex = this.buffer.length;
    const buffer = this.buffer;
    let index;
    for (index = this.index; index < lastIndex; ++index) {
      const character = buffer[index];
      if (character === '"') {
        this.closingDoubleQuoteRegex.lastIndex = index;
        if (!this.closingDoubleQuoteRegex.test(buffer)) {
          break;
        }
        index = this.closingDoubleQuoteRegex.lastIndex - 1;
      } else if (character === "{") {
        ++this.balance;
      } else if (character === "}") {
        --this.balance;
        if (this.balance < 0) {
          this.reportBalanced();
          return false;
        }
        if (!this.balance) {
          this.lastBalancedIndex = index + 1;
          if (!this.findMultiple) {
            break;
          }
        }
      } else if (character === "]" && !this.balance) {
        this.reportBalanced();
        return false;
      }
    }
    this.index = index;
    this.reportBalanced();
    return true;
  }
  reportBalanced() {
    if (!this.lastBalancedIndex) {
      return;
    }
    this.callback(this.buffer.slice(0, this.lastBalancedIndex));
    this.buffer = this.buffer.slice(this.lastBalancedIndex);
    this.index -= this.lastBalancedIndex;
    this.lastBalancedIndex = 0;
  }
  remainder() {
    return this.buffer;
  }
}
export function isMinified(text) {
  const kMaxNonMinifiedLength = 500;
  let linesToCheck = 10;
  let lastPosition = 0;
  do {
    let eolIndex = text.indexOf("\n", lastPosition);
    if (eolIndex < 0) {
      eolIndex = text.length;
    }
    if (eolIndex - lastPosition > kMaxNonMinifiedLength && text.substr(lastPosition, 3) !== "//#") {
      return true;
    }
    lastPosition = eolIndex + 1;
  } while (--linesToCheck >= 0 && lastPosition < text.length);
  linesToCheck = 10;
  lastPosition = text.length;
  do {
    let eolIndex = text.lastIndexOf("\n", lastPosition);
    if (eolIndex < 0) {
      eolIndex = 0;
    }
    if (lastPosition - eolIndex > kMaxNonMinifiedLength && text.substr(lastPosition, 3) !== "//#") {
      return true;
    }
    lastPosition = eolIndex - 1;
  } while (--linesToCheck >= 0 && lastPosition > 0);
  return false;
}
export const performSearchInContent = function(content, query, caseSensitive, isRegex) {
  const regex = Platform.StringUtilities.createSearchRegex(query, caseSensitive, isRegex);
  const text = new Text(content);
  const result = [];
  for (let i = 0; i < text.lineCount(); ++i) {
    const lineContent = text.lineAt(i);
    regex.lastIndex = 0;
    const match = regex.exec(lineContent);
    if (match) {
      result.push(new SearchMatch(i, lineContent, match.index));
    }
  }
  return result;
};
//# sourceMappingURL=TextUtils.js.map
