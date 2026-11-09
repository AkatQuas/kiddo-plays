#include "QtBridgeV8Handler.h"

#include "include/cef_process_message.h"

bool QtBridgeV8Handler::Execute(const CefString &name,
                                CefRefPtr<CefV8Value> object,
                                const CefV8ValueList &arguments,
                                CefRefPtr<CefV8Value> &retval,
                                CefString &exception)
{
    (void)object;
    (void)exception;

    if (name != "QtBridge") {
        return false;
    }
    if (arguments.size() != 4) {
        retval = CefV8Value::CreateInt(2);
        return true;
    }
    for (size_t i = 0; i < 4; ++i) {
        if (!arguments[i].get() || !arguments[i]->IsString()) {
            retval = CefV8Value::CreateInt(3);
            return true;
        }
    }

    CefRefPtr<CefFrame> frame;
    if (CefRefPtr<CefV8Context> ctx = CefV8Context::GetCurrentContext()) {
        frame = ctx->GetFrame();
    }
    if (!frame.get() && browser) {
        frame = browser->GetMainFrame();
    }
    if (!frame.get()) {
        retval = CefV8Value::CreateInt(4);
        return true;
    }

    CefRefPtr<CefProcessMessage> message =
        CefProcessMessage::Create("QtBridge.Native.Call");
    message->GetArgumentList()->SetString(0, arguments[0]->GetStringValue());
    message->GetArgumentList()->SetString(1, arguments[1]->GetStringValue());
    message->GetArgumentList()->SetString(2, arguments[2]->GetStringValue());
    message->GetArgumentList()->SetString(3, arguments[3]->GetStringValue());
    frame->SendProcessMessage(PID_BROWSER, message);

    retval = CefV8Value::CreateInt(0);
    return true;
}
