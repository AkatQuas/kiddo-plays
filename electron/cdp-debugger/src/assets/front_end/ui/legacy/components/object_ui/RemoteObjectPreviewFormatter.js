import * as i18n from "../../../../core/i18n/i18n.js";
import * as Platform from "../../../../core/platform/platform.js";
import * as SDK from "../../../../core/sdk/sdk.js";
import * as Protocol from "../../../../generated/protocol.js";
import * as UI from "../../legacy.js";
const UIStrings = {
  emptyD: "empty \xD7 {PH1}",
  empty: "empty",
  thePropertyIsComputedWithAGetter: "The property is computed with a getter"
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/components/object_ui/RemoteObjectPreviewFormatter.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class RemoteObjectPreviewFormatter {
  static objectPropertyComparator(a, b) {
    return sortValue(a) - sortValue(b);
    function sortValue(property) {
      if (property.name === InternalName.PromiseState) {
        return 1;
      }
      if (property.name === InternalName.PromiseResult) {
        return 2;
      }
      if (property.name === InternalName.GeneratorState || property.name === InternalName.PrimitiveValue) {
        return 3;
      }
      if (property.type !== Protocol.Runtime.PropertyPreviewType.Function && !property.name.startsWith("#")) {
        return 4;
      }
      return 5;
    }
  }
  appendObjectPreview(parentElement, preview, isEntry) {
    const description = preview.description;
    const subTypesWithoutValuePreview = /* @__PURE__ */ new Set([
      Protocol.Runtime.ObjectPreviewSubtype.Arraybuffer,
      Protocol.Runtime.ObjectPreviewSubtype.Dataview,
      Protocol.Runtime.ObjectPreviewSubtype.Error,
      Protocol.Runtime.ObjectPreviewSubtype.Null,
      Protocol.Runtime.ObjectPreviewSubtype.Regexp,
      Protocol.Runtime.ObjectPreviewSubtype.Webassemblymemory,
      "internal#entry",
      "trustedtype"
    ]);
    if (preview.type !== Protocol.Runtime.ObjectPreviewType.Object || preview.subtype && subTypesWithoutValuePreview.has(preview.subtype) || isEntry) {
      parentElement.appendChild(this.renderPropertyPreview(preview.type, preview.subtype, void 0, description));
      return;
    }
    const isArrayOrTypedArray = preview.subtype === Protocol.Runtime.ObjectPreviewSubtype.Array || preview.subtype === Protocol.Runtime.ObjectPreviewSubtype.Typedarray;
    if (description) {
      let text;
      if (isArrayOrTypedArray) {
        const arrayLength = SDK.RemoteObject.RemoteObject.arrayLength(preview);
        const arrayLengthText = arrayLength > 1 ? "(" + arrayLength + ")" : "";
        const arrayName = SDK.RemoteObject.RemoteObject.arrayNameFromDescription(description);
        text = arrayName === "Array" ? arrayLengthText : arrayName + arrayLengthText;
      } else {
        const hideDescription = description === "Object";
        text = hideDescription ? "" : description;
      }
      if (text.length > 0) {
        parentElement.createChild("span", "object-description").textContent = text + "\xA0";
      }
    }
    const propertiesElement = parentElement.createChild("span", "object-properties-preview");
    UI.UIUtils.createTextChild(propertiesElement, isArrayOrTypedArray ? "[" : "{");
    if (preview.entries) {
      this.appendEntriesPreview(propertiesElement, preview);
    } else if (isArrayOrTypedArray) {
      this.appendArrayPropertiesPreview(propertiesElement, preview);
    } else {
      this.appendObjectPropertiesPreview(propertiesElement, preview);
    }
    if (preview.overflow) {
      const ellipsisText = propertiesElement.textContent && propertiesElement.textContent.length > 1 ? ",\xA0\u2026" : "\u2026";
      propertiesElement.createChild("span").textContent = ellipsisText;
    }
    UI.UIUtils.createTextChild(propertiesElement, isArrayOrTypedArray ? "]" : "}");
  }
  abbreviateFullQualifiedClassName(description) {
    const abbreviatedDescription = description.split(".");
    for (let i = 0; i < abbreviatedDescription.length - 1; ++i) {
      abbreviatedDescription[i] = Platform.StringUtilities.trimMiddle(abbreviatedDescription[i], 3);
    }
    return abbreviatedDescription.join(".");
  }
  appendObjectPropertiesPreview(parentElement, preview) {
    const properties = preview.properties.filter((p) => p.type !== "accessor").sort(RemoteObjectPreviewFormatter.objectPropertyComparator);
    for (let i = 0; i < properties.length; ++i) {
      if (i > 0) {
        UI.UIUtils.createTextChild(parentElement, ", ");
      }
      const property = properties[i];
      const name = property.name;
      if (preview.subtype === Protocol.Runtime.ObjectPreviewSubtype.Promise && name === InternalName.PromiseState) {
        parentElement.appendChild(this.renderDisplayName("<" + property.value + ">"));
        const nextProperty = i + 1 < properties.length ? properties[i + 1] : null;
        if (nextProperty && nextProperty.name === InternalName.PromiseResult) {
          if (property.value !== "pending") {
            UI.UIUtils.createTextChild(parentElement, ": ");
            parentElement.appendChild(this.renderPropertyPreviewOrAccessor([nextProperty]));
          }
          i++;
        }
      } else if (preview.subtype === "generator" && name === InternalName.GeneratorState) {
        parentElement.appendChild(this.renderDisplayName("<" + property.value + ">"));
      } else if (name === InternalName.PrimitiveValue) {
        parentElement.appendChild(this.renderPropertyPreviewOrAccessor([property]));
      } else {
        parentElement.appendChild(this.renderDisplayName(name));
        UI.UIUtils.createTextChild(parentElement, ": ");
        parentElement.appendChild(this.renderPropertyPreviewOrAccessor([property]));
      }
    }
  }
  appendArrayPropertiesPreview(parentElement, preview) {
    const arrayLength = SDK.RemoteObject.RemoteObject.arrayLength(preview);
    const indexProperties = preview.properties.filter((p) => toArrayIndex(p.name) !== -1).sort(arrayEntryComparator);
    const otherProperties = preview.properties.filter((p) => toArrayIndex(p.name) === -1).sort(RemoteObjectPreviewFormatter.objectPropertyComparator);
    function arrayEntryComparator(a, b) {
      return toArrayIndex(a.name) - toArrayIndex(b.name);
    }
    function toArrayIndex(name) {
      const index = Number(name) >>> 0;
      if (String(index) === name && index < arrayLength) {
        return index;
      }
      return -1;
    }
    const canShowGaps = !preview.overflow;
    let lastNonEmptyArrayIndex = -1;
    let elementsAdded = false;
    for (let i = 0; i < indexProperties.length; ++i) {
      if (elementsAdded) {
        UI.UIUtils.createTextChild(parentElement, ", ");
      }
      const property = indexProperties[i];
      const index = toArrayIndex(property.name);
      if (canShowGaps && index - lastNonEmptyArrayIndex > 1) {
        appendUndefined(index);
        UI.UIUtils.createTextChild(parentElement, ", ");
      }
      if (!canShowGaps && i !== index) {
        parentElement.appendChild(this.renderDisplayName(property.name));
        UI.UIUtils.createTextChild(parentElement, ": ");
      }
      parentElement.appendChild(this.renderPropertyPreviewOrAccessor([property]));
      lastNonEmptyArrayIndex = index;
      elementsAdded = true;
    }
    if (canShowGaps && arrayLength - lastNonEmptyArrayIndex > 1) {
      if (elementsAdded) {
        UI.UIUtils.createTextChild(parentElement, ", ");
      }
      appendUndefined(arrayLength);
    }
    for (let i = 0; i < otherProperties.length; ++i) {
      if (elementsAdded) {
        UI.UIUtils.createTextChild(parentElement, ", ");
      }
      const property = otherProperties[i];
      parentElement.appendChild(this.renderDisplayName(property.name));
      UI.UIUtils.createTextChild(parentElement, ": ");
      parentElement.appendChild(this.renderPropertyPreviewOrAccessor([property]));
      elementsAdded = true;
    }
    function appendUndefined(index) {
      const span = parentElement.createChild("span", "object-value-undefined");
      const count = index - lastNonEmptyArrayIndex - 1;
      span.textContent = count !== 1 ? i18nString(UIStrings.emptyD, { PH1: count }) : i18nString(UIStrings.empty);
      elementsAdded = true;
    }
  }
  appendEntriesPreview(parentElement, preview) {
    if (!preview.entries) {
      return;
    }
    for (let i = 0; i < preview.entries.length; ++i) {
      if (i > 0) {
        UI.UIUtils.createTextChild(parentElement, ", ");
      }
      const entry = preview.entries[i];
      if (entry.key) {
        this.appendObjectPreview(parentElement, entry.key, true);
        UI.UIUtils.createTextChild(parentElement, " => ");
      }
      this.appendObjectPreview(parentElement, entry.value, true);
    }
  }
  renderDisplayName(name) {
    const result = document.createElement("span");
    result.classList.add("name");
    const needsQuotes = /^\s|\s$|^$|\n/.test(name);
    result.textContent = needsQuotes ? '"' + name.replace(/\n/g, "\u21B5") + '"' : name;
    return result;
  }
  renderPropertyPreviewOrAccessor(propertyPath) {
    const property = propertyPath[propertyPath.length - 1];
    if (!property) {
      throw new Error("Could not find property");
    }
    return this.renderPropertyPreview(property.type, property.subtype, property.name, property.value);
  }
  renderPropertyPreview(type, subtype, className, description) {
    const span = document.createElement("span");
    span.classList.add("object-value-" + (subtype || type));
    description = description || "";
    if (type === "accessor") {
      span.textContent = "(...)";
      UI.Tooltip.Tooltip.install(span, i18nString(UIStrings.thePropertyIsComputedWithAGetter));
      return span;
    }
    if (type === "function") {
      span.textContent = "\u0192";
      return span;
    }
    if (type === "object" && subtype === "trustedtype" && className) {
      createSpanForTrustedType(span, description, className);
      return span;
    }
    if (type === "object" && subtype === "node" && description) {
      createSpansForNodeTitle(span, description);
      return span;
    }
    if (type === "string") {
      UI.UIUtils.createTextChildren(span, Platform.StringUtilities.formatAsJSLiteral(description));
      return span;
    }
    if (type === "object" && !subtype) {
      let preview = this.abbreviateFullQualifiedClassName(description);
      if (preview === "Object") {
        preview = "{\u2026}";
      }
      span.textContent = preview;
      UI.Tooltip.Tooltip.install(span, description);
      return span;
    }
    span.textContent = description;
    return span;
  }
}
var InternalName = /* @__PURE__ */ ((InternalName2) => {
  InternalName2["GeneratorState"] = "[[GeneratorState]]";
  InternalName2["PrimitiveValue"] = "[[PrimitiveValue]]";
  InternalName2["PromiseState"] = "[[PromiseState]]";
  InternalName2["PromiseResult"] = "[[PromiseResult]]";
  return InternalName2;
})(InternalName || {});
export const createSpansForNodeTitle = function(container, nodeTitle) {
  const match = nodeTitle.match(/([^#.]+)(#[^.]+)?(\..*)?/);
  if (!match) {
    return;
  }
  container.createChild("span", "webkit-html-tag-name").textContent = match[1];
  if (match[2]) {
    container.createChild("span", "webkit-html-attribute-value").textContent = match[2];
  }
  if (match[3]) {
    container.createChild("span", "webkit-html-attribute-name").textContent = match[3];
  }
};
export const createSpanForTrustedType = function(span, description, className) {
  UI.UIUtils.createTextChildren(span, `${className} `);
  const trustedContentSpan = document.createElement("span");
  trustedContentSpan.classList.add("object-value-string");
  UI.UIUtils.createTextChildren(trustedContentSpan, '"', description.replace(/\n/g, "\u21B5"), '"');
  span.appendChild(trustedContentSpan);
};
//# sourceMappingURL=RemoteObjectPreviewFormatter.js.map
