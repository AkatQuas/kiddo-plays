import * as FrontendHelpers from "../../../../../test/unittests/front_end/helpers/EnvironmentHelpers.js";
import * as EmulationComponents from "../../../../panels/settings/emulation/components/components.js";
import * as ComponentHelpers from "../../helpers/helpers.js";
await ComponentHelpers.ComponentServerSetup.setup();
await FrontendHelpers.initializeGlobalVars();
const userAgentClientHintsContainer = document.getElementById("user-agent-client-hints-container");
const userAgentsForm = new EmulationComponents.UserAgentClientHintsForm.UserAgentClientHintsForm();
userAgentsForm.value = {
  metaData: {
    fullVersion: "",
    platform: "",
    platformVersion: "",
    architecture: "",
    model: "",
    mobile: true
  },
  showMobileCheckbox: true
};
userAgentClientHintsContainer?.appendChild(userAgentsForm);
//# sourceMappingURL=basic.js.map
