#include "SystemModule.h"

void registerSystemModule(BridgeBus &bus)
{
    bus.registerHandler("system", "getVersion",
                        [](const std::string &, BridgeBus::EmitFn) {
                            return R"({"version":"qtbridge-poc/0.0.0","host":"qt+cef"})";
                        });

    bus.registerHandler("system", "ping",
                        [](const std::string &param, BridgeBus::EmitFn) {
                            return std::string("{\"ok\":true,\"echo\":") +
                                   (param.empty() ? "{}" : param) + "}";
                        });
}
