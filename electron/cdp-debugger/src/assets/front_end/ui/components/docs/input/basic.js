import * as FrontendHelpers from "../../../../../test/unittests/front_end/helpers/EnvironmentHelpers.js";
import * as ComponentHelpers from "../../helpers/helpers.js";
import * as Input from "../../input/input.js";
await ComponentHelpers.ComponentServerSetup.setup();
await FrontendHelpers.initializeGlobalVars();
document.adoptedStyleSheets = [Input.textInputStyles];
//# sourceMappingURL=basic.js.map
