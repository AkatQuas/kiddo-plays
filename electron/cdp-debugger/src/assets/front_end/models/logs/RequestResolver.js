import * as Common from "../../core/common/common.js";
import { Events as NetworkLogEvents, NetworkLog } from "./NetworkLog.js";
export class RequestResolver extends Common.ResolverBase.ResolverBase {
  networkListener = null;
  networkLog;
  constructor(networkLog = NetworkLog.instance()) {
    super();
    this.networkLog = networkLog;
  }
  getForId(id) {
    const requests = this.networkLog.requestsForId(id);
    if (requests.length > 0) {
      return requests[0];
    }
    return null;
  }
  onRequestAdded(event) {
    const request = event.data;
    const backendRequestId = request.backendRequestId();
    if (backendRequestId) {
      this.onResolve(backendRequestId, request);
    }
  }
  startListening() {
    if (this.networkListener) {
      return;
    }
    this.networkListener = this.networkLog.addEventListener(NetworkLogEvents.RequestAdded, this.onRequestAdded, this);
  }
  stopListening() {
    if (!this.networkListener) {
      return;
    }
    Common.EventTarget.removeEventListeners([this.networkListener]);
    this.networkListener = null;
  }
}
//# sourceMappingURL=RequestResolver.js.map
