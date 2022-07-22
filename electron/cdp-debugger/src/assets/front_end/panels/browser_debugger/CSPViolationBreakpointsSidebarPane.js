import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
import { CategorizedBreakpointsSidebarPane } from "./CategorizedBreakpointsSidebarPane.js";
let cspViolationBreakpointsSidebarPaneInstance;
export class CSPViolationBreakpointsSidebarPane extends CategorizedBreakpointsSidebarPane {
  constructor() {
    const breakpoints = SDK.DOMDebuggerModel.DOMDebuggerManager.instance().cspViolationBreakpoints();
    const categories = breakpoints.map((breakpoint) => breakpoint.category());
    categories.sort();
    super(categories, breakpoints, "sources.cspViolationBreakpoints", Protocol.Debugger.PausedEventReason.CSPViolation);
  }
  static instance() {
    if (!cspViolationBreakpointsSidebarPaneInstance) {
      cspViolationBreakpointsSidebarPaneInstance = new CSPViolationBreakpointsSidebarPane();
    }
    return cspViolationBreakpointsSidebarPaneInstance;
  }
  getBreakpointFromPausedDetails(details) {
    const breakpointType = details.auxData && details.auxData["violationType"] ? details.auxData["violationType"] : "";
    const breakpoints = SDK.DOMDebuggerModel.DOMDebuggerManager.instance().cspViolationBreakpoints();
    const breakpoint = breakpoints.find((x) => x.type() === breakpointType);
    return breakpoint ? breakpoint : null;
  }
  toggleBreakpoint(breakpoint, enabled) {
    breakpoint.setEnabled(enabled);
    SDK.DOMDebuggerModel.DOMDebuggerManager.instance().updateCSPViolationBreakpoints();
  }
}
//# sourceMappingURL=CSPViolationBreakpointsSidebarPane.js.map
