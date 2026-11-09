#pragma once

#include "QtBridgeClient.h"

#include <QWidget>
#include <QTimer>

/** QWidget that hosts a CEF browser window. */
class QtBridgeView : public QWidget {
    Q_OBJECT
public:
    explicit QtBridgeView(BridgeBus *bus, QWidget *parent = nullptr);
    ~QtBridgeView() override;

    void loadUrl(const QString &url);

protected:
    void resizeEvent(QResizeEvent *event) override;
    void showEvent(QShowEvent *event) override;

private:
    void ensureBrowser();
    void pumpCef();

    BridgeBus *bus_ = nullptr;
    CefRefPtr<QtBridgeClient> client_;
    QTimer pump_;
    bool browser_created_ = false;
};
