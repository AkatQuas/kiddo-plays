import * as ThemeSupport from "../../legacy/theme_support/theme_support.js";
export async function setup() {
  const setting = {
    get() {
      return "default";
    }
  };
  ThemeSupport.ThemeSupport.instance({ forceNew: true, setting });
}
//# sourceMappingURL=component-server-setup.js.map
