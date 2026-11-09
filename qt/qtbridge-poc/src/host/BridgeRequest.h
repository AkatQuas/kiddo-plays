#pragma once

#include <string>

struct BridgeRequest {
    std::string module;
    std::string method;
    std::string callbackId;
    std::string param;
};
