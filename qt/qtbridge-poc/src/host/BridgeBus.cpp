#include "BridgeBus.h"

void BridgeBus::registerHandler(const std::string &module,
                                const std::string &method,
                                Handler handler)
{
    modules_[module][method] = std::move(handler);
}

void BridgeBus::dispatch(const BridgeRequest &req, ReplyFn reply, EmitFn emit)
{
    auto mit = modules_.find(req.module);
    if (mit == modules_.end()) {
        reply(req.callbackId, "unknown module: " + req.module, "{}");
        return;
    }
    auto hit = mit->second.find(req.method);
    if (hit == mit->second.end()) {
        reply(req.callbackId,
              "unknown method: " + req.module + "." + req.method,
              "{}");
        return;
    }
    try {
        const std::string body = hit->second(req.param, emit);
        reply(req.callbackId, "", body.empty() ? "{}" : body);
    } catch (const std::exception &ex) {
        reply(req.callbackId, ex.what(), "{}");
    } catch (...) {
        reply(req.callbackId, "handler failed", "{}");
    }
}
