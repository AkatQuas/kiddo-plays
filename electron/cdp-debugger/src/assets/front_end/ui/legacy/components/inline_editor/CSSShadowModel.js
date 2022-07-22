import * as Common from "../../../../core/common/common.js";
import * as TextUtils from "../../../../models/text_utils/text_utils.js";
export class CSSShadowModel {
  isBoxShadowInternal;
  insetInternal;
  offsetXInternal;
  offsetYInternal;
  blurRadiusInternal;
  spreadRadiusInternal;
  colorInternal;
  format;
  important;
  constructor(isBoxShadow) {
    this.isBoxShadowInternal = isBoxShadow;
    this.insetInternal = false;
    this.offsetXInternal = CSSLength.zero();
    this.offsetYInternal = CSSLength.zero();
    this.blurRadiusInternal = CSSLength.zero();
    this.spreadRadiusInternal = CSSLength.zero();
    this.colorInternal = Common.Color.Color.parse("black");
    this.format = [Part.OffsetX, Part.OffsetY];
    this.important = false;
  }
  static parseTextShadow(text) {
    return CSSShadowModel.parseShadow(text, false);
  }
  static parseBoxShadow(text) {
    return CSSShadowModel.parseShadow(text, true);
  }
  static parseShadow(text, isBoxShadow) {
    const shadowTexts = [];
    const splits = TextUtils.TextUtils.Utils.splitStringByRegexes(text, [Common.Color.Regex, /,/g]);
    let currentIndex = 0;
    for (let i = 0; i < splits.length; i++) {
      if (splits[i].regexIndex === 1) {
        const comma = splits[i];
        shadowTexts.push(text.substring(currentIndex, comma.position));
        currentIndex = comma.position + 1;
      }
    }
    shadowTexts.push(text.substring(currentIndex, text.length));
    const shadows = [];
    for (let i = 0; i < shadowTexts.length; i++) {
      const shadow = new CSSShadowModel(isBoxShadow);
      shadow.format = [];
      let nextPartAllowed = true;
      const regexes = [/!important/gi, /inset/gi, Common.Color.Regex, CSSLength.Regex];
      const results = TextUtils.TextUtils.Utils.splitStringByRegexes(shadowTexts[i], regexes);
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.regexIndex === -1) {
          if (/\S/.test(result.value)) {
            return [];
          }
          nextPartAllowed = true;
        } else {
          if (!nextPartAllowed) {
            return [];
          }
          nextPartAllowed = false;
          if (result.regexIndex === 0) {
            shadow.important = true;
            shadow.format.push(Part.Important);
          } else if (result.regexIndex === 1) {
            shadow.insetInternal = true;
            shadow.format.push(Part.Inset);
          } else if (result.regexIndex === 2) {
            const color = Common.Color.Color.parse(result.value);
            if (!color) {
              return [];
            }
            shadow.colorInternal = color;
            shadow.format.push(Part.Color);
          } else if (result.regexIndex === 3) {
            const length = CSSLength.parse(result.value);
            if (!length) {
              return [];
            }
            const previousPart = shadow.format.length > 0 ? shadow.format[shadow.format.length - 1] : "";
            if (previousPart === Part.OffsetX) {
              shadow.offsetYInternal = length;
              shadow.format.push(Part.OffsetY);
            } else if (previousPart === Part.OffsetY) {
              shadow.blurRadiusInternal = length;
              shadow.format.push(Part.BlurRadius);
            } else if (previousPart === Part.BlurRadius) {
              shadow.spreadRadiusInternal = length;
              shadow.format.push(Part.SpreadRadius);
            } else {
              shadow.offsetXInternal = length;
              shadow.format.push(Part.OffsetX);
            }
          }
        }
      }
      if (invalidCount(shadow, Part.OffsetX, 1, 1) || invalidCount(shadow, Part.OffsetY, 1, 1) || invalidCount(shadow, Part.Color, 0, 1) || invalidCount(shadow, Part.BlurRadius, 0, 1) || invalidCount(shadow, Part.Inset, 0, isBoxShadow ? 1 : 0) || invalidCount(shadow, Part.SpreadRadius, 0, isBoxShadow ? 1 : 0) || invalidCount(shadow, Part.Important, 0, 1)) {
        return [];
      }
      shadows.push(shadow);
    }
    return shadows;
    function invalidCount(shadow, part, min, max) {
      let count = 0;
      for (let i = 0; i < shadow.format.length; i++) {
        if (shadow.format[i] === part) {
          count++;
        }
      }
      return count < min || count > max;
    }
  }
  setInset(inset) {
    this.insetInternal = inset;
    if (this.format.indexOf(Part.Inset) === -1) {
      this.format.unshift(Part.Inset);
    }
  }
  setOffsetX(offsetX) {
    this.offsetXInternal = offsetX;
  }
  setOffsetY(offsetY) {
    this.offsetYInternal = offsetY;
  }
  setBlurRadius(blurRadius) {
    this.blurRadiusInternal = blurRadius;
    if (this.format.indexOf(Part.BlurRadius) === -1) {
      const yIndex = this.format.indexOf(Part.OffsetY);
      this.format.splice(yIndex + 1, 0, Part.BlurRadius);
    }
  }
  setSpreadRadius(spreadRadius) {
    this.spreadRadiusInternal = spreadRadius;
    if (this.format.indexOf(Part.SpreadRadius) === -1) {
      this.setBlurRadius(this.blurRadiusInternal);
      const blurIndex = this.format.indexOf(Part.BlurRadius);
      this.format.splice(blurIndex + 1, 0, Part.SpreadRadius);
    }
  }
  setColor(color) {
    this.colorInternal = color;
    if (this.format.indexOf(Part.Color) === -1) {
      this.format.push(Part.Color);
    }
  }
  isBoxShadow() {
    return this.isBoxShadowInternal;
  }
  inset() {
    return this.insetInternal;
  }
  offsetX() {
    return this.offsetXInternal;
  }
  offsetY() {
    return this.offsetYInternal;
  }
  blurRadius() {
    return this.blurRadiusInternal;
  }
  spreadRadius() {
    return this.spreadRadiusInternal;
  }
  color() {
    return this.colorInternal;
  }
  asCSSText() {
    const parts = [];
    for (let i = 0; i < this.format.length; i++) {
      const part = this.format[i];
      if (part === Part.Inset && this.insetInternal) {
        parts.push("inset");
      } else if (part === Part.OffsetX) {
        parts.push(this.offsetXInternal.asCSSText());
      } else if (part === Part.OffsetY) {
        parts.push(this.offsetYInternal.asCSSText());
      } else if (part === Part.BlurRadius) {
        parts.push(this.blurRadiusInternal.asCSSText());
      } else if (part === Part.SpreadRadius) {
        parts.push(this.spreadRadiusInternal.asCSSText());
      } else if (part === Part.Color) {
        parts.push(this.colorInternal.asString(this.colorInternal.format()));
      } else if (part === Part.Important && this.important) {
        parts.push("!important");
      }
    }
    return parts.join(" ");
  }
}
var Part = /* @__PURE__ */ ((Part2) => {
  Part2["Inset"] = "I";
  Part2["OffsetX"] = "X";
  Part2["OffsetY"] = "Y";
  Part2["BlurRadius"] = "B";
  Part2["SpreadRadius"] = "S";
  Part2["Color"] = "C";
  Part2["Important"] = "M";
  return Part2;
})(Part || {});
export class CSSLength {
  amount;
  unit;
  constructor(amount, unit) {
    this.amount = amount;
    this.unit = unit;
  }
  static parse(text) {
    const lengthRegex = new RegExp("^(?:" + CSSLength.Regex.source + ")$", "i");
    const match = text.match(lengthRegex);
    if (!match) {
      return null;
    }
    if (match.length > 2 && match[2]) {
      return new CSSLength(parseFloat(match[1]), match[2]);
    }
    return CSSLength.zero();
  }
  static zero() {
    return new CSSLength(0, "");
  }
  asCSSText() {
    return this.amount + this.unit;
  }
  static Regex = function() {
    const number = "([+-]?(?:[0-9]*[.])?[0-9]+(?:[eE][+-]?[0-9]+)?)";
    const unit = "(ch|cm|em|ex|in|mm|pc|pt|px|rem|vh|vmax|vmin|vw)";
    const zero = "[+-]?(?:0*[.])?0+(?:[eE][+-]?[0-9]+)?";
    return new RegExp(number + unit + "|" + zero, "gi");
  }();
}
//# sourceMappingURL=CSSShadowModel.js.map
