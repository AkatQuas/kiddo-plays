import * as FrontendHelpers from "../../../../../test/unittests/front_end/helpers/EnvironmentHelpers.js";
import * as TimelineComponents from "../../../../panels/timeline/components/components.js";
import * as ComponentHelpers from "../../helpers/helpers.js";
await FrontendHelpers.initializeGlobalVars();
await ComponentHelpers.ComponentServerSetup.setup();
const component = new TimelineComponents.WebVitalsTimeline.WebVitalsTimeline();
document.getElementById("container")?.appendChild(component);
component.data = {
  startTime: 0,
  duration: 1e3,
  maxDuration: 15e3,
  fcps: [0, 250, 500, 750, 1e3, 1250, 1500, 2e3, 3e3, 4e3, 5e3].map((t) => ({ timestamp: t })),
  lcps: [190, 380, 700].map((t) => ({ timestamp: t })),
  layoutShifts: [200, 210, 220, 222, 225, 227, 230, 500].map((t) => ({ timestamp: t })),
  longTasks: [
    { start: 300, duration: 400 },
    { start: 850, duration: 50 }
  ],
  mainFrameNavigations: [500, 1500, 12e3]
};
//# sourceMappingURL=webvitals.js.map
