export const markdownImages = /* @__PURE__ */ new Map([]);
export const getMarkdownImage = (key) => {
  const image = markdownImages.get(key);
  if (!image) {
    throw new Error(`Markdown image with key '${key}' is not available, please check MarkdownImagesMap.ts`);
  }
  return image;
};
//# sourceMappingURL=MarkdownImagesMap.js.map
