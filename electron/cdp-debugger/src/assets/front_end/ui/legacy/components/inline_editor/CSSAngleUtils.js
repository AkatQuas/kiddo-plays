import * as Platform from "../../../../core/platform/platform.js";
import * as UI from "../../legacy.js";
export const CSSAngleRegex = /(?<value>[+-]?\d*\.?\d+)(?<unit>deg|grad|rad|turn)/;
export var AngleUnit = /* @__PURE__ */ ((AngleUnit2) => {
  AngleUnit2["Deg"] = "deg";
  AngleUnit2["Grad"] = "grad";
  AngleUnit2["Rad"] = "rad";
  AngleUnit2["Turn"] = "turn";
  return AngleUnit2;
})(AngleUnit || {});
export const parseText = (text) => {
  const result = text.match(CSSAngleRegex);
  if (!result || !result.groups) {
    return null;
  }
  return {
    value: Number(result.groups.value),
    unit: result.groups.unit
  };
};
export const getAngleFromRadians = (rad, targetUnit) => {
  let value = rad;
  switch (targetUnit) {
    case "grad" /* Grad */:
      value = UI.Geometry.radiansToGradians(rad);
      break;
    case "deg" /* Deg */:
      value = UI.Geometry.radiansToDegrees(rad);
      break;
    case "turn" /* Turn */:
      value = UI.Geometry.radiansToTurns(rad);
      break;
  }
  return {
    value,
    unit: targetUnit
  };
};
export const getRadiansFromAngle = (angle) => {
  switch (angle.unit) {
    case "deg" /* Deg */:
      return UI.Geometry.degreesToRadians(angle.value);
    case "grad" /* Grad */:
      return UI.Geometry.gradiansToRadians(angle.value);
    case "turn" /* Turn */:
      return UI.Geometry.turnsToRadians(angle.value);
  }
  return angle.value;
};
export const get2DTranslationsForAngle = (angle, radius) => {
  const radian = getRadiansFromAngle(angle);
  return {
    translateX: Math.sin(radian) * radius,
    translateY: -Math.cos(radian) * radius
  };
};
export const roundAngleByUnit = (angle) => {
  let roundedValue = angle.value;
  switch (angle.unit) {
    case "deg" /* Deg */:
    case "grad" /* Grad */:
      roundedValue = Math.round(angle.value);
      break;
    case "rad" /* Rad */:
      roundedValue = Math.round(angle.value * 1e4) / 1e4;
      break;
    case "turn" /* Turn */:
      roundedValue = Math.round(angle.value * 100) / 100;
      break;
    default:
      Platform.assertNever(angle.unit, `Unknown angle unit: ${angle.unit}`);
  }
  return {
    value: roundedValue,
    unit: angle.unit
  };
};
export const getNextUnit = (currentUnit) => {
  switch (currentUnit) {
    case "deg" /* Deg */:
      return "grad" /* Grad */;
    case "grad" /* Grad */:
      return "rad" /* Rad */;
    case "rad" /* Rad */:
      return "turn" /* Turn */;
    default:
      return "deg" /* Deg */;
  }
};
export const convertAngleUnit = (angle, newUnit) => {
  if (angle.unit === newUnit) {
    return angle;
  }
  const radian = getRadiansFromAngle(angle);
  return getAngleFromRadians(radian, newUnit);
};
export const getNewAngleFromEvent = (angle, event) => {
  const direction = UI.UIUtils.getValueModificationDirection(event);
  if (direction === null) {
    return;
  }
  let diff = direction === "Up" ? Math.PI / 180 : -Math.PI / 180;
  if (event.shiftKey) {
    diff *= 10;
  }
  const radian = getRadiansFromAngle(angle);
  return getAngleFromRadians(radian + diff, angle.unit);
};
//# sourceMappingURL=CSSAngleUtils.js.map
