import { getLocalizedString, registerUIStrings } from "./i18nImpl.js";
const UIStrings = {
  fmms: "{PH1}\xA0\u03BCs",
  fms: "{PH1}\xA0ms",
  fs: "{PH1}\xA0s",
  fmin: "{PH1}\xA0min",
  fhrs: "{PH1}\xA0hrs",
  fdays: "{PH1}\xA0days"
};
const str_ = registerUIStrings("core/i18n/time-utilities.ts", UIStrings);
const i18nString = getLocalizedString.bind(void 0, str_);
export const preciseMillisToString = function(ms, precision) {
  precision = precision || 0;
  return i18nString(UIStrings.fms, { PH1: ms.toFixed(precision) });
};
export const millisToString = function(ms, higherResolution) {
  if (!isFinite(ms)) {
    return "-";
  }
  if (ms === 0) {
    return "0";
  }
  if (higherResolution && ms < 0.1) {
    return i18nString(UIStrings.fmms, { PH1: (ms * 1e3).toFixed(0) });
  }
  if (higherResolution && ms < 1e3) {
    return i18nString(UIStrings.fms, { PH1: ms.toFixed(2) });
  }
  if (ms < 1e3) {
    return i18nString(UIStrings.fms, { PH1: ms.toFixed(0) });
  }
  const seconds = ms / 1e3;
  if (seconds < 60) {
    return i18nString(UIStrings.fs, { PH1: seconds.toFixed(2) });
  }
  const minutes = seconds / 60;
  if (minutes < 60) {
    return i18nString(UIStrings.fmin, { PH1: minutes.toFixed(1) });
  }
  const hours = minutes / 60;
  if (hours < 24) {
    return i18nString(UIStrings.fhrs, { PH1: hours.toFixed(1) });
  }
  const days = hours / 24;
  return i18nString(UIStrings.fdays, { PH1: days.toFixed(1) });
};
export const secondsToString = function(seconds, higherResolution) {
  if (!isFinite(seconds)) {
    return "-";
  }
  return millisToString(seconds * 1e3, higherResolution);
};
//# sourceMappingURL=time-utilities.js.map
