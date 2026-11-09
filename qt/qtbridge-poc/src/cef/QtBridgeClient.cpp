#include "QtBridgeClient.h"

#include "../host/BridgeRequest.h"

#include <sstream>

QtBridgeClient::QtBridgeClient(BusPtr bus)
    : bus_(bus)
{
}

bool QtBridgeClient::OnProcessMessageReceived(CefRefPtr<CefBrowser> browser,
                                              CefRefPtr<CefFrame> frame,
                                              CefProcessId source_process,
                                              CefRefPtr<CefProcessMessage> message)
{
    (void)frame;
    (void)source_process;
    if (!message || message->GetName() != "QtBridge.Native.Call") {
        return false;
    }
    if (!bus_ || !browser) {
        return false;
    }
    auto args = message->GetArgumentList();
    if (!args || args->GetSize() < 4) {
        return false;
    }

    BridgeRequest req;
    req.module = args->GetString(0).ToString();
    req.method = args->GetString(1).ToString();
    req.callbackId = args->GetString(2).ToString();
    req.param = args->GetString(3).ToString();

    bus_->dispatch(
        req,
        [this](const std::string &cb, const std::string &err, const std::string &data) {
            reply(cb, err, data);
        },
        [this](const std::string &ev, const std::string &data) { emitEvent(ev, data); });
    return true;
}

void QtBridgeClient::OnAfterCreated(CefRefPtr<CefBrowser> browser)
{
    browser_ = browser;
}

void QtBridgeClient::OnBeforeClose(CefRefPtr<CefBrowser> browser)
{
    if (browser_ && browser_->IsSame(browser)) {
        browser_ = nullptr;
    }
}

void QtBridgeClient::reply(const std::string &callbackId,
                           const std::string &errorInfo,
                           const std::string &dataJson)
{
    // Page callback shape: onCallback(callbackId, errorInfo, data)
    std::ostringstream oss;
    oss << "typeof onCallback==='function'&&onCallback('"
        << callbackId << "','" << errorInfo << "'," << (dataJson.empty() ? "{}" : dataJson)
        << ");";
    execJs(oss.str());
}

void QtBridgeClient::emitEvent(const std::string &eventId, const std::string &dataJson)
{
    std::ostringstream oss;
    oss << "typeof onEvent==='function'&&onEvent('" << eventId << "',"
        << (dataJson.empty() ? "{}" : dataJson) << ");";
    execJs(oss.str());
}

void QtBridgeClient::execJs(const std::string &script)
{
    if (!browser_) {
        return;
    }
    CefRefPtr<CefFrame> frame = browser_->GetMainFrame();
    if (!frame) {
        return;
    }
    frame->ExecuteJavaScript(script, frame->GetURL(), 0);
}
