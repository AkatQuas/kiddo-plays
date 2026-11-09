#include "QtBridgeView.h"

#include "include/cef_browser.h"
#include "include/internal/cef_types.h"

#include <QResizeEvent>
#include <QShowEvent>

#if defined(Q_OS_WIN)
#include <windows.h>
#endif

QtBridgeView::QtBridgeView(BridgeBus *bus, QWidget *parent)
    : QWidget(parent)
    , bus_(bus)
    , client_(new QtBridgeClient(bus))
{
    setAttribute(Qt::WA_NativeWindow);
    setAttribute(Qt::WA_DontCreateNativeAncestors);

    // Qt + CEF: external message pump via QTimer.
    connect(&pump_, &QTimer::timeout, this, &QtBridgeView::pumpCef);
    pump_.start(10);
}

QtBridgeView::~QtBridgeView()
{
    pump_.stop();
    if (client_ && client_->browser()) {
        client_->browser()->GetHost()->CloseBrowser(true);
    }
}

void QtBridgeView::loadUrl(const QString &url)
{
    ensureBrowser();
    if (client_ && client_->browser()) {
        client_->browser()->GetMainFrame()->LoadURL(url.toStdString());
    }
}

void QtBridgeView::showEvent(QShowEvent *event)
{
    QWidget::showEvent(event);
    ensureBrowser();
}

void QtBridgeView::resizeEvent(QResizeEvent *event)
{
    QWidget::resizeEvent(event);
    if (client_ && client_->browser()) {
        client_->browser()->GetHost()->WasResized();
#if defined(Q_OS_WIN)
        HWND hwnd = reinterpret_cast<HWND>(client_->browser()->GetHost()->GetWindowHandle());
        if (hwnd) {
            MoveWindow(hwnd, 0, 0, width(), height(), TRUE);
        }
#endif
    }
}

void QtBridgeView::ensureBrowser()
{
    if (browser_created_ || !winId()) {
        return;
    }
    browser_created_ = true;

    const int w = width() > 0 ? width() : 800;
    const int h = height() > 0 ? height() : 600;
    CefWindowInfo window_info;
    CefRect bounds(0, 0, w, h);
#if defined(Q_OS_WIN)
    window_info.SetAsChild(reinterpret_cast<HWND>(winId()), bounds);
#else
    window_info.SetAsChild(reinterpret_cast<CefWindowHandle>(winId()), bounds);
#endif

    CefBrowserSettings settings;
    CefBrowserHost::CreateBrowser(window_info, client_, "about:blank", settings, nullptr, nullptr);
}

void QtBridgeView::pumpCef()
{
    CefDoMessageLoopWork();
}
