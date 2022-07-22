import "../../../Images/Images.js";
import * as CreateBreadcrumbs from "./create_breadcrumbs.js";
import * as ToggleDarkMode from "./toggle_dark_mode.js";
import * as ToggleFonts from "./toggle_fonts.js";
ToggleDarkMode.init();
CreateBreadcrumbs.init();
ToggleFonts.init();
window.addEventListener("hidecomponentdocsui", () => {
  for (const node of document.querySelectorAll(".component-docs-ui")) {
    node.style.display = "none";
  }
});
window.addEventListener("showcomponentdocsui", () => {
  for (const node of document.querySelectorAll(".component-docs-ui")) {
    node.style.display = "";
  }
});
//# sourceMappingURL=component_docs.js.map
