import * as TextUtils from "../../models/text_utils/text_utils.js";
import { cssMetadata } from "./CSSMetadata.js";
import { CSSProperty } from "./CSSProperty.js";
export class CSSStyleDeclaration {
  #cssModelInternal;
  parentRule;
  #allPropertiesInternal;
  styleSheetId;
  range;
  cssText;
  #shorthandValues;
  #shorthandIsImportant;
  #activePropertyMap;
  #leadingPropertiesInternal;
  type;
  constructor(cssModel, parentRule, payload, type) {
    this.#cssModelInternal = cssModel;
    this.parentRule = parentRule;
    this.reinitialize(payload);
    this.type = type;
  }
  rebase(edit) {
    if (this.styleSheetId !== edit.styleSheetId || !this.range) {
      return;
    }
    if (edit.oldRange.equal(this.range)) {
      this.reinitialize(edit.payload);
    } else {
      this.range = this.range.rebaseAfterTextEdit(edit.oldRange, edit.newRange);
      for (let i = 0; i < this.#allPropertiesInternal.length; ++i) {
        this.#allPropertiesInternal[i].rebase(edit);
      }
    }
  }
  reinitialize(payload) {
    this.styleSheetId = payload.styleSheetId;
    this.range = payload.range ? TextUtils.TextRange.TextRange.fromObject(payload.range) : null;
    const shorthandEntries = payload.shorthandEntries;
    this.#shorthandValues = /* @__PURE__ */ new Map();
    this.#shorthandIsImportant = /* @__PURE__ */ new Set();
    for (let i = 0; i < shorthandEntries.length; ++i) {
      this.#shorthandValues.set(shorthandEntries[i].name, shorthandEntries[i].value);
      if (shorthandEntries[i].important) {
        this.#shorthandIsImportant.add(shorthandEntries[i].name);
      }
    }
    this.#allPropertiesInternal = [];
    if (payload.cssText && this.range) {
      const cssText = new TextUtils.Text.Text(payload.cssText);
      let start = { line: this.range.startLine, column: this.range.startColumn };
      for (const cssProperty of payload.cssProperties) {
        const range = cssProperty.range;
        if (range) {
          parseUnusedText.call(this, cssText, start.line, start.column, range.startLine, range.startColumn);
          start = { line: range.endLine, column: range.endColumn };
        }
        this.#allPropertiesInternal.push(CSSProperty.parsePayload(this, this.#allPropertiesInternal.length, cssProperty));
      }
      parseUnusedText.call(this, cssText, start.line, start.column, this.range.endLine, this.range.endColumn);
    } else {
      for (const cssProperty of payload.cssProperties) {
        this.#allPropertiesInternal.push(CSSProperty.parsePayload(this, this.#allPropertiesInternal.length, cssProperty));
      }
    }
    this.generateSyntheticPropertiesIfNeeded();
    this.computeInactiveProperties();
    this.#activePropertyMap = /* @__PURE__ */ new Map();
    for (const property of this.#allPropertiesInternal) {
      if (!property.activeInStyle()) {
        continue;
      }
      this.#activePropertyMap.set(property.name, property);
    }
    this.cssText = payload.cssText;
    this.#leadingPropertiesInternal = null;
    function parseUnusedText(cssText, startLine, startColumn, endLine, endColumn) {
      const tr = new TextUtils.TextRange.TextRange(startLine, startColumn, endLine, endColumn);
      if (!this.range) {
        return;
      }
      const missingText = cssText.extract(tr.relativeTo(this.range.startLine, this.range.startColumn));
      const lines = missingText.split("\n");
      let lineNumber = 0;
      let inComment = false;
      for (const line of lines) {
        let column = 0;
        for (const property of line.split(";")) {
          const strippedProperty = stripComments(property, inComment);
          const trimmedProperty = strippedProperty.text.trim();
          inComment = strippedProperty.inComment;
          if (trimmedProperty) {
            let name;
            let value;
            const colonIndex = trimmedProperty.indexOf(":");
            if (colonIndex === -1) {
              name = trimmedProperty;
              value = "";
            } else {
              name = trimmedProperty.substring(0, colonIndex).trim();
              value = trimmedProperty.substring(colonIndex + 1).trim();
            }
            const range = new TextUtils.TextRange.TextRange(lineNumber, column, lineNumber, column + property.length);
            this.#allPropertiesInternal.push(new CSSProperty(this, this.#allPropertiesInternal.length, name, value, false, false, false, false, property, range.relativeFrom(startLine, startColumn)));
          }
          column += property.length + 1;
        }
        lineNumber++;
      }
    }
    function stripComments(text, inComment) {
      let output = "";
      for (let i = 0; i < text.length; i++) {
        if (!inComment && text.substring(i, i + 2) === "/*") {
          inComment = true;
          i++;
        } else if (inComment && text.substring(i, i + 2) === "*/") {
          inComment = false;
          i++;
        } else if (!inComment) {
          output += text[i];
        }
      }
      return { text: output, inComment };
    }
  }
  generateSyntheticPropertiesIfNeeded() {
    if (this.range) {
      return;
    }
    if (!this.#shorthandValues.size) {
      return;
    }
    const propertiesSet = /* @__PURE__ */ new Set();
    for (const property of this.#allPropertiesInternal) {
      propertiesSet.add(property.name);
    }
    const generatedProperties = [];
    for (const property of this.#allPropertiesInternal) {
      const shorthands = cssMetadata().getShorthands(property.name) || [];
      for (const shorthand of shorthands) {
        if (propertiesSet.has(shorthand)) {
          continue;
        }
        const shorthandValue = this.#shorthandValues.get(shorthand);
        if (!shorthandValue) {
          continue;
        }
        const shorthandImportance = Boolean(this.#shorthandIsImportant.has(shorthand));
        const shorthandProperty = new CSSProperty(this, this.allProperties().length, shorthand, shorthandValue, shorthandImportance, false, true, false);
        generatedProperties.push(shorthandProperty);
        propertiesSet.add(shorthand);
      }
    }
    this.#allPropertiesInternal = this.#allPropertiesInternal.concat(generatedProperties);
  }
  computeLeadingProperties() {
    function propertyHasRange(property) {
      return Boolean(property.range);
    }
    if (this.range) {
      return this.#allPropertiesInternal.filter(propertyHasRange);
    }
    const leadingProperties = [];
    for (const property of this.#allPropertiesInternal) {
      const shorthands = cssMetadata().getShorthands(property.name) || [];
      let belongToAnyShorthand = false;
      for (const shorthand of shorthands) {
        if (this.#shorthandValues.get(shorthand)) {
          belongToAnyShorthand = true;
          break;
        }
      }
      if (!belongToAnyShorthand) {
        leadingProperties.push(property);
      }
    }
    return leadingProperties;
  }
  leadingProperties() {
    if (!this.#leadingPropertiesInternal) {
      this.#leadingPropertiesInternal = this.computeLeadingProperties();
    }
    return this.#leadingPropertiesInternal;
  }
  target() {
    return this.#cssModelInternal.target();
  }
  cssModel() {
    return this.#cssModelInternal;
  }
  computeInactiveProperties() {
    const activeProperties = /* @__PURE__ */ new Map();
    for (let i = 0; i < this.#allPropertiesInternal.length; ++i) {
      const property = this.#allPropertiesInternal[i];
      if (property.disabled || !property.parsedOk) {
        property.setActive(false);
        continue;
      }
      const metadata = cssMetadata();
      const canonicalName = metadata.canonicalPropertyName(property.name);
      const longhands = metadata.getLonghands(canonicalName);
      if (longhands) {
        for (const longhand of longhands) {
          const activeLonghand = activeProperties.get(longhand);
          if (activeLonghand && activeLonghand.range && (!activeLonghand.important || property.important)) {
            activeLonghand.setActive(false);
            activeProperties.delete(longhand);
          }
        }
      }
      const activeProperty = activeProperties.get(canonicalName);
      if (!activeProperty) {
        activeProperties.set(canonicalName, property);
      } else if (!property.range) {
        property.setActive(false);
      } else if (!activeProperty.important || property.important) {
        activeProperty.setActive(false);
        activeProperties.set(canonicalName, property);
      } else {
        property.setActive(false);
      }
    }
  }
  allProperties() {
    return this.#allPropertiesInternal;
  }
  hasActiveProperty(name) {
    return this.#activePropertyMap.has(name);
  }
  getPropertyValue(name) {
    const property = this.#activePropertyMap.get(name);
    return property ? property.value : "";
  }
  isPropertyImplicit(name) {
    const property = this.#activePropertyMap.get(name);
    return property ? property.implicit : false;
  }
  longhandProperties(name) {
    const longhands = cssMetadata().getLonghands(name.toLowerCase());
    const result = [];
    for (let i = 0; longhands && i < longhands.length; ++i) {
      const property = this.#activePropertyMap.get(longhands[i]);
      if (property) {
        result.push(property);
      }
    }
    return result;
  }
  propertyAt(index) {
    return index < this.allProperties().length ? this.allProperties()[index] : null;
  }
  pastLastSourcePropertyIndex() {
    for (let i = this.allProperties().length - 1; i >= 0; --i) {
      if (this.allProperties()[i].range) {
        return i + 1;
      }
    }
    return 0;
  }
  insertionRange(index) {
    const property = this.propertyAt(index);
    if (property && property.range) {
      return property.range.collapseToStart();
    }
    if (!this.range) {
      throw new Error("CSSStyleDeclaration.range is null");
    }
    return this.range.collapseToEnd();
  }
  newBlankProperty(index) {
    index = typeof index === "undefined" ? this.pastLastSourcePropertyIndex() : index;
    const property = new CSSProperty(this, index, "", "", false, false, true, false, "", this.insertionRange(index));
    return property;
  }
  setText(text, majorChange) {
    if (!this.range || !this.styleSheetId) {
      return Promise.resolve(false);
    }
    return this.#cssModelInternal.setStyleText(this.styleSheetId, this.range, text, majorChange);
  }
  insertPropertyAt(index, name, value, userCallback) {
    void this.newBlankProperty(index).setText(name + ": " + value + ";", false, true).then(userCallback);
  }
  appendProperty(name, value, userCallback) {
    this.insertPropertyAt(this.allProperties().length, name, value, userCallback);
  }
}
export var Type = /* @__PURE__ */ ((Type2) => {
  Type2["Regular"] = "Regular";
  Type2["Inline"] = "Inline";
  Type2["Attributes"] = "Attributes";
  return Type2;
})(Type || {});
//# sourceMappingURL=CSSStyleDeclaration.js.map
