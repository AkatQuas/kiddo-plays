import * as FrontendHelpers from "../../../../../test/unittests/front_end/helpers/EnvironmentHelpers.js";
import * as Common from "../../../../core/common/common.js";
import * as ComponentHelpers from "../../helpers/helpers.js";
import * as SurveyLink from "../../survey_link/survey_link.js";
await ComponentHelpers.ComponentServerSetup.setup();
await FrontendHelpers.initializeGlobalVars();
const link = new SurveyLink.SurveyLink.SurveyLink();
document.getElementById("container")?.appendChild(link);
link.data = {
  trigger: "test trigger",
  promptText: Common.UIString.LocalizedEmptyString,
  canShowSurvey: (trigger, callback) => {
    setTimeout(callback.bind(void 0, { canShowSurvey: true }), 500);
  },
  showSurvey: (trigger, callback) => {
    setTimeout(callback.bind(void 0, { surveyShown: true }), 1500);
  }
};
//# sourceMappingURL=basic.js.map
