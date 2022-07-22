import { TimelineController } from "./TimelineController.js";
import { TimelineUIUtils } from "./TimelineUIUtils.js";
import { UIDevtoolsUtils } from "./UIDevtoolsUtils.js";
export class UIDevtoolsController extends TimelineController {
  constructor(target, client) {
    super(target, client);
    TimelineUIUtils.setEventStylesMap(UIDevtoolsUtils.categorizeEvents());
    TimelineUIUtils.setCategories(UIDevtoolsUtils.categories());
    TimelineUIUtils.setTimelineMainEventCategories(UIDevtoolsUtils.getMainCategoriesList());
  }
}
//# sourceMappingURL=UIDevtoolsController.js.map
