import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
import * as TextUtils from "../../models/text_utils/text_utils.js";
export class ConsoleFilter {
  name;
  parsedFilters;
  executionContext;
  levelsMask;
  constructor(name, parsedFilters, executionContext, levelsMask) {
    this.name = name;
    this.parsedFilters = parsedFilters;
    this.executionContext = executionContext;
    this.levelsMask = levelsMask || ConsoleFilter.defaultLevelsFilterValue();
  }
  static allLevelsFilterValue() {
    const result = {};
    const logLevels = {
      Verbose: Protocol.Log.LogEntryLevel.Verbose,
      Info: Protocol.Log.LogEntryLevel.Info,
      Warning: Protocol.Log.LogEntryLevel.Warning,
      Error: Protocol.Log.LogEntryLevel.Error
    };
    for (const name of Object.values(logLevels)) {
      result[name] = true;
    }
    return result;
  }
  static defaultLevelsFilterValue() {
    const result = ConsoleFilter.allLevelsFilterValue();
    result[Protocol.Log.LogEntryLevel.Verbose] = false;
    return result;
  }
  static singleLevelMask(level) {
    const result = {};
    result[level] = true;
    return result;
  }
  clone() {
    const parsedFilters = this.parsedFilters.map(TextUtils.TextUtils.FilterParser.cloneFilter);
    const levelsMask = Object.assign({}, this.levelsMask);
    return new ConsoleFilter(this.name, parsedFilters, this.executionContext, levelsMask);
  }
  shouldBeVisible(viewMessage) {
    const message = viewMessage.consoleMessage();
    if (this.executionContext && (this.executionContext.runtimeModel !== message.runtimeModel() || this.executionContext.id !== message.getExecutionContextId())) {
      return false;
    }
    if (message.type === SDK.ConsoleModel.FrontendMessageType.Command || message.type === SDK.ConsoleModel.FrontendMessageType.Result || message.type === Protocol.Runtime.ConsoleAPICalledEventType.EndGroup) {
      return true;
    }
    if (message.level && !this.levelsMask[message.level]) {
      return false;
    }
    return this.applyFilter(viewMessage) || this.parentGroupHasMatch(viewMessage.consoleGroup());
  }
  parentGroupHasMatch(viewMessage) {
    if (viewMessage === null) {
      return false;
    }
    return this.applyFilter(viewMessage) || this.parentGroupHasMatch(viewMessage.consoleGroup());
  }
  applyFilter(viewMessage) {
    const message = viewMessage.consoleMessage();
    for (const filter of this.parsedFilters) {
      if (!filter.key) {
        if (filter.regex && viewMessage.matchesFilterRegex(filter.regex) === filter.negative) {
          return false;
        }
        if (filter.text && viewMessage.matchesFilterText(filter.text) === filter.negative) {
          return false;
        }
      } else {
        switch (filter.key) {
          case FilterType.Context: {
            if (!passesFilter(filter, message.context, false)) {
              return false;
            }
            break;
          }
          case FilterType.Source: {
            const sourceNameForMessage = message.source ? SDK.ConsoleModel.MessageSourceDisplayName.get(message.source) : message.source;
            if (!passesFilter(filter, sourceNameForMessage, true)) {
              return false;
            }
            break;
          }
          case FilterType.Url: {
            if (!passesFilter(filter, message.url, false)) {
              return false;
            }
            break;
          }
        }
      }
    }
    return true;
    function passesFilter(filter, value, exactMatch) {
      if (!filter.text) {
        return Boolean(value) === filter.negative;
      }
      if (!value) {
        return !filter.text === !filter.negative;
      }
      const filterText = filter.text.toLowerCase();
      const lowerCaseValue = value.toLowerCase();
      if (exactMatch && lowerCaseValue === filterText === filter.negative) {
        return false;
      }
      if (!exactMatch && lowerCaseValue.includes(filterText) === filter.negative) {
        return false;
      }
      return true;
    }
  }
}
export var FilterType = /* @__PURE__ */ ((FilterType2) => {
  FilterType2["Context"] = "context";
  FilterType2["Source"] = "source";
  FilterType2["Url"] = "url";
  return FilterType2;
})(FilterType || {});
//# sourceMappingURL=ConsoleFilter.js.map
