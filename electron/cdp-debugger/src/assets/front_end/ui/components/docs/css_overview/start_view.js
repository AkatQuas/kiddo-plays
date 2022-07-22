import * as FrontendHelpers from "../../../../../test/unittests/front_end/helpers/EnvironmentHelpers.js";
import * as CSSOverviewComponents from "../../../../panels/css_overview/components/components.js";
import * as ComponentHelpers from "../../helpers/helpers.js";
await ComponentHelpers.ComponentServerSetup.setup();
await FrontendHelpers.initializeGlobalVars();
const component = new CSSOverviewComponents.CSSOverviewStartView.CSSOverviewStartView();
document.getElementById("container")?.appendChild(component);
//# sourceMappingURL=start_view.js.map
