import * as Common from "../../../../core/common/common.js";
export class ContrastInfo extends Common.ObjectWrapper.ObjectWrapper {
  isNullInternal;
  contrastRatioInternal;
  contrastRatioAPCAInternal;
  contrastRatioThresholds;
  contrastRationAPCAThreshold;
  fgColor;
  bgColorInternal;
  colorFormatInternal;
  constructor(contrastInfo) {
    super();
    this.isNullInternal = true;
    this.contrastRatioInternal = null;
    this.contrastRatioAPCAInternal = null;
    this.contrastRatioThresholds = null;
    this.contrastRationAPCAThreshold = 0;
    this.fgColor = null;
    this.bgColorInternal = null;
    if (!contrastInfo) {
      return;
    }
    if (!contrastInfo.computedFontSize || !contrastInfo.computedFontWeight || !contrastInfo.backgroundColors || contrastInfo.backgroundColors.length !== 1) {
      return;
    }
    this.isNullInternal = false;
    this.contrastRatioThresholds = Common.ColorUtils.getContrastThreshold(contrastInfo.computedFontSize, contrastInfo.computedFontWeight);
    this.contrastRationAPCAThreshold = Common.ColorUtils.getAPCAThreshold(contrastInfo.computedFontSize, contrastInfo.computedFontWeight);
    const bgColorText = contrastInfo.backgroundColors[0];
    const bgColor = Common.Color.Color.parse(bgColorText);
    if (bgColor) {
      this.setBgColorInternal(bgColor);
    }
  }
  isNull() {
    return this.isNullInternal;
  }
  setColor(fgColor, colorFormat) {
    this.fgColor = fgColor;
    this.colorFormatInternal = colorFormat;
    this.updateContrastRatio();
    this.dispatchEventToListeners(Events.ContrastInfoUpdated);
  }
  colorFormat() {
    return this.colorFormatInternal;
  }
  color() {
    return this.fgColor;
  }
  contrastRatio() {
    return this.contrastRatioInternal;
  }
  contrastRatioAPCA() {
    return this.contrastRatioAPCAInternal;
  }
  contrastRatioAPCAThreshold() {
    return this.contrastRationAPCAThreshold;
  }
  setBgColor(bgColor) {
    this.setBgColorInternal(bgColor);
    this.dispatchEventToListeners(Events.ContrastInfoUpdated);
  }
  setBgColorInternal(bgColor) {
    this.bgColorInternal = bgColor;
    if (!this.fgColor) {
      return;
    }
    const fgRGBA = this.fgColor.rgba();
    if (bgColor.hasAlpha()) {
      const blendedRGBA = Common.ColorUtils.blendColors(bgColor.rgba(), fgRGBA);
      this.bgColorInternal = new Common.Color.Color(blendedRGBA, Common.Color.Format.RGBA);
    }
    this.contrastRatioInternal = Common.ColorUtils.contrastRatio(fgRGBA, this.bgColorInternal.rgba());
    this.contrastRatioAPCAInternal = Common.ColorUtils.contrastRatioAPCA(this.fgColor.rgba(), this.bgColorInternal.rgba());
  }
  bgColor() {
    return this.bgColorInternal;
  }
  updateContrastRatio() {
    if (!this.bgColorInternal || !this.fgColor) {
      return;
    }
    this.contrastRatioInternal = Common.ColorUtils.contrastRatio(this.fgColor.rgba(), this.bgColorInternal.rgba());
    this.contrastRatioAPCAInternal = Common.ColorUtils.contrastRatioAPCA(this.fgColor.rgba(), this.bgColorInternal.rgba());
  }
  contrastRatioThreshold(level) {
    if (!this.contrastRatioThresholds) {
      return null;
    }
    return this.contrastRatioThresholds[level];
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["ContrastInfoUpdated"] = "ContrastInfoUpdated";
  return Events2;
})(Events || {});
//# sourceMappingURL=ContrastInfo.js.map
