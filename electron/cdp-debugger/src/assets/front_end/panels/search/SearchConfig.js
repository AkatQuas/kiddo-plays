import * as Platform from "../../core/platform/platform.js";
export class SearchConfig {
  queryInternal;
  ignoreCaseInternal;
  isRegexInternal;
  fileQueries;
  queriesInternal;
  fileRegexQueries;
  constructor(query, ignoreCase, isRegex) {
    this.queryInternal = query;
    this.ignoreCaseInternal = ignoreCase;
    this.isRegexInternal = isRegex;
    this.parse();
  }
  static fromPlainObject(object) {
    return new SearchConfig(object.query, object.ignoreCase, object.isRegex);
  }
  query() {
    return this.queryInternal;
  }
  ignoreCase() {
    return this.ignoreCaseInternal;
  }
  isRegex() {
    return this.isRegexInternal;
  }
  toPlainObject() {
    return { query: this.query(), ignoreCase: this.ignoreCase(), isRegex: this.isRegex() };
  }
  parse() {
    const quotedPattern = /"([^\\"]|\\.)+"/;
    const unquotedWordPattern = /(\s*(?!-?f(ile)?:)[^\\ ]|\\.)+/;
    const unquotedPattern = unquotedWordPattern.source + "(\\s+" + unquotedWordPattern.source + ")*";
    const pattern = [
      "(\\s*" + FilePatternRegex.source + "\\s*)",
      "(" + quotedPattern.source + ")",
      "(" + unquotedPattern + ")"
    ].join("|");
    const regexp = new RegExp(pattern, "g");
    const queryParts = this.queryInternal.match(regexp) || [];
    this.fileQueries = [];
    this.queriesInternal = [];
    for (let i = 0; i < queryParts.length; ++i) {
      const queryPart = queryParts[i];
      if (!queryPart) {
        continue;
      }
      const fileQuery = this.parseFileQuery(queryPart);
      if (fileQuery) {
        this.fileQueries.push(fileQuery);
        this.fileRegexQueries = this.fileRegexQueries || [];
        this.fileRegexQueries.push({ regex: new RegExp(fileQuery.text, this.ignoreCase() ? "i" : ""), isNegative: fileQuery.isNegative });
        continue;
      }
      if (this.isRegexInternal) {
        this.queriesInternal.push(queryPart);
        continue;
      }
      if (queryPart.startsWith('"')) {
        if (!queryPart.endsWith('"')) {
          continue;
        }
        this.queriesInternal.push(this.parseQuotedQuery(queryPart));
        continue;
      }
      this.queriesInternal.push(this.parseUnquotedQuery(queryPart));
    }
  }
  filePathMatchesFileQuery(filePath) {
    if (!this.fileRegexQueries) {
      return true;
    }
    for (let i = 0; i < this.fileRegexQueries.length; ++i) {
      if (Boolean(filePath.match(this.fileRegexQueries[i].regex)) === this.fileRegexQueries[i].isNegative) {
        return false;
      }
    }
    return true;
  }
  queries() {
    return this.queriesInternal || [];
  }
  parseUnquotedQuery(query) {
    return query.replace(/\\(.)/g, "$1");
  }
  parseQuotedQuery(query) {
    return query.substring(1, query.length - 1).replace(/\\(.)/g, "$1");
  }
  parseFileQuery(query) {
    const match = query.match(FilePatternRegex);
    if (!match) {
      return null;
    }
    const isNegative = Boolean(match[1]);
    query = match[3];
    let result = "";
    for (let i = 0; i < query.length; ++i) {
      const char = query[i];
      if (char === "*") {
        result += ".*";
      } else if (char === "\\") {
        ++i;
        const nextChar = query[i];
        if (nextChar === " ") {
          result += " ";
        }
      } else {
        if (Platform.StringUtilities.regexSpecialCharacters().indexOf(query.charAt(i)) !== -1) {
          result += "\\";
        }
        result += query.charAt(i);
      }
    }
    return new QueryTerm(result, isNegative);
  }
}
export const FilePatternRegex = /(-)?f(ile)?:((?:[^\\ ]|\\.)+)/;
export class QueryTerm {
  text;
  isNegative;
  constructor(text, isNegative) {
    this.text = text;
    this.isNegative = isNegative;
  }
}
//# sourceMappingURL=SearchConfig.js.map
