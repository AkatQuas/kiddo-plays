import * as FrontendHelpers from "../../../../../test/unittests/front_end/helpers/EnvironmentHelpers.js";
import * as ComponentHelpers from "../../helpers/helpers.js";
import * as TextPrompt from "../../text_prompt/text_prompt.js";
await ComponentHelpers.ComponentServerSetup.setup();
await FrontendHelpers.initializeGlobalVars();
const textPrompt = new TextPrompt.TextPrompt.TextPrompt();
document.getElementById("container")?.appendChild(textPrompt);
textPrompt.data = {
  ariaLabel: "Quick open prompt",
  prefix: "Open",
  suggestion: "File"
};
//# sourceMappingURL=basic.js.map
