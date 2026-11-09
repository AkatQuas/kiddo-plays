#pragma once

#include "include/cef_client.h"
#include "include/cef_life_span_handler.h"
#include "../host/BridgeBus.h"

/** Browser-process client: receives QtBridge.Native.Call and runs JS callbacks. */
class QtBridgeClient : public CefClient,
                       public CefLifeSpanHandler,
                       public CefDisplayHandler {
public:
    using BusPtr = BridgeBus *;

    explicit QtBridgeClient(BusPtr bus);

    CefRefPtr<CefLifeSpanHandler> GetLifeSpanHandler() override { return this; }
    CefRefPtr<CefDisplayHandler> GetDisplayHandler() override { return this; }

    bool OnProcessMessageReceived(CefRefPtr<CefBrowser> browser,
                                  CefRefPtr<CefFrame> frame,
                                  CefProcessId source_process,
                                  CefRefPtr<CefProcessMessage> message) override;

    void OnAfterCreated(CefRefPtr<CefBrowser> browser) override;
    void OnBeforeClose(CefRefPtr<CefBrowser> browser) override;

    void reply(const std::string &callbackId,
               const std::string &errorInfo,
               const std::string &dataJson);
    void emitEvent(const std::string &eventId, const std::string &dataJson);

    CefRefPtr<CefBrowser> browser() const { return browser_; }

private:
    void execJs(const std::string &script);

    BusPtr bus_ = nullptr;
    CefRefPtr<CefBrowser> browser_;
    IMPLEMENT_REFCOUNTING(QtBridgeClient);
};
