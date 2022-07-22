export const clamp = (num, min, max) => {
  let clampedNumber = num;
  if (num < min) {
    clampedNumber = min;
  } else if (num > max) {
    clampedNumber = max;
  }
  return clampedNumber;
};
export const mod = (m, n) => {
  return (m % n + n) % n;
};
export const bytesToString = (bytes) => {
  if (bytes < 1e3) {
    return `${bytes.toFixed(0)}\xA0B`;
  }
  const kilobytes = bytes / 1e3;
  if (kilobytes < 100) {
    return `${kilobytes.toFixed(1)}\xA0kB`;
  }
  if (kilobytes < 1e3) {
    return `${kilobytes.toFixed(0)}\xA0kB`;
  }
  const megabytes = kilobytes / 1e3;
  if (megabytes < 100) {
    return `${megabytes.toFixed(1)}\xA0MB`;
  }
  return `${megabytes.toFixed(0)}\xA0MB`;
};
export const toFixedIfFloating = (value) => {
  if (!value || Number.isNaN(Number(value))) {
    return value;
  }
  const number = Number(value);
  return number % 1 ? number.toFixed(3) : String(number);
};
export const floor = (value, precision = 0) => {
  const mult = Math.pow(10, precision);
  return Math.floor(value * mult) / mult;
};
export const greatestCommonDivisor = (a, b) => {
  a = Math.round(a);
  b = Math.round(b);
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
};
const commonRatios = /* @__PURE__ */ new Map([
  ["8\u22365", "16\u223610"]
]);
export const aspectRatio = (width, height) => {
  const divisor = greatestCommonDivisor(width, height);
  if (divisor !== 0) {
    width /= divisor;
    height /= divisor;
  }
  const result = `${width}\u2236${height}`;
  return commonRatios.get(result) || result;
};
export const withThousandsSeparator = function(num) {
  let str = String(num);
  const re = /(\d+)(\d{3})/;
  while (str.match(re)) {
    str = str.replace(re, "$1\xA0$2");
  }
  return str;
};
//# sourceMappingURL=number-utilities.js.map
