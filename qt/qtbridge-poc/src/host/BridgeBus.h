#pragma once

#include "BridgeRequest.h"

#include <functional>
#include <map>
#include <string>

/** Routes QtBridge calls by module + method. */
class BridgeBus {
public:
    using ReplyFn = std::function<void(const std::string &callbackId,
                                       const std::string &errorInfo,
                                       const std::string &dataJson)>;
    using EmitFn = std::function<void(const std::string &eventId,
                                      const std::string &dataJson)>;
    using Handler = std::function<std::string(const std::string &paramJson, EmitFn emit)>;

    void registerHandler(const std::string &module,
                         const std::string &method,
                         Handler handler);

    void dispatch(const BridgeRequest &req, ReplyFn reply, EmitFn emit);

private:
    std::map<std::string, std::map<std::string, Handler>> modules_;
};
