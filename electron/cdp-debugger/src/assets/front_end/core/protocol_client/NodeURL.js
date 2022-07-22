import * as Common from "../common/common.js";
import * as Host from "../host/host.js";
export class NodeURL {
  static patch(object) {
    process(object, "");
    function process(object2, path) {
      if (object2.url && NodeURL.isPlatformPath(object2.url, Host.Platform.isWin())) {
        object2.url = Common.ParsedURL.ParsedURL.rawPathToUrlString(object2.url);
      }
      for (const entry of Object.entries(object2)) {
        const key = entry[0];
        const value = entry[1];
        const entryPath = path + "." + key;
        if (entryPath !== ".result.result.value" && value !== null && typeof value === "object") {
          process(value, entryPath);
        }
      }
    }
  }
  static isPlatformPath(fileSystemPath, isWindows) {
    if (isWindows) {
      const re = /^([a-z]:[\/\\]|\\\\)/i;
      return re.test(fileSystemPath);
    }
    return fileSystemPath.length ? fileSystemPath[0] === "/" : false;
  }
}
//# sourceMappingURL=NodeURL.js.map
