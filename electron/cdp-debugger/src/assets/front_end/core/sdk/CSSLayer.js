import * as TextUtils from "../../models/text_utils/text_utils.js";
import { CSSQuery } from "./CSSQuery.js";
export class CSSLayer extends CSSQuery {
  static parseLayerPayload(cssModel, payload) {
    return payload.map((supports) => new CSSLayer(cssModel, supports));
  }
  constructor(cssModel, payload) {
    super(cssModel);
    this.reinitialize(payload);
  }
  reinitialize(payload) {
    this.text = payload.text;
    this.range = payload.range ? TextUtils.TextRange.TextRange.fromObject(payload.range) : null;
    this.styleSheetId = payload.styleSheetId;
  }
  active() {
    return true;
  }
}
//# sourceMappingURL=CSSLayer.js.map
