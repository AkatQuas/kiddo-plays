export const convertRGBToHex = (rgb: string) => {
  const match = /rgb\((\d{1,3}), (\d{1,3}), (\d{1,3})\)/.exec(rgb);
  if (!match) {
    return null;
  }
  return rgbToHex(match[1], match[2], match[3]);
};

export function rgbToHex(r: string, g: string, b: string) {
  return (
    '#' +
    ((1 << 24) + (parseInt(r) << 16) + (parseInt(g) << 8) + parseInt(b))
      .toString(16)
      .slice(1)
  );
}

export function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return {
      r: 0,
      g: 0,
      b: 0,
    };
  }
  const [_, red, green, blue] = result;
  return {
    r: parseInt(red, 16),
    g: parseInt(green, 16),
    b: parseInt(blue, 16),
  };
}

export function luminance(sHexColor: string, sLight: string, sDark: string) {
  const oRGB = hexToRgb(sHexColor);
  const yiq = (oRGB.r * 299 + oRGB.g * 587 + oRGB.b * 114) / 1000;
  return yiq >= 128 ? sDark : sLight;
}
