let _measuredScrollbarWidth;
export function resetMeasuredScrollbarWidthForTest() {
  _measuredScrollbarWidth = void 0;
}
export function measuredScrollbarWidth(document) {
  if (typeof _measuredScrollbarWidth === "number") {
    return _measuredScrollbarWidth;
  }
  if (!document) {
    return 16;
  }
  const scrollDiv = document.createElement("div");
  const innerDiv = document.createElement("div");
  scrollDiv.setAttribute("style", "display: block; width: 100px; height: 100px; overflow: scroll;");
  innerDiv.setAttribute("style", "height: 200px");
  scrollDiv.appendChild(innerDiv);
  document.body.appendChild(scrollDiv);
  _measuredScrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
  document.body.removeChild(scrollDiv);
  return _measuredScrollbarWidth;
}
//# sourceMappingURL=measured-scrollbar-width.js.map
