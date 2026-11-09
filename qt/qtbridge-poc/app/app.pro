QT += core gui widgets network
CONFIG += c++17
TEMPLATE = app
TARGET = qtbridge-poc

include($$PWD/../cef.pri)
INCLUDEPATH += $$PWD/../src

SOURCES += \
    $$PWD/../src/main.cpp \
    $$PWD/../src/host/CefBootstrap.cpp \
    $$PWD/../src/host/BridgeBus.cpp \
    $$PWD/../src/host/modules/SystemModule.cpp \
    $$PWD/../src/host/modules/SidecarModule.cpp \
    $$PWD/../src/cef/QtBridgeApp.cpp \
    $$PWD/../src/cef/QtBridgeV8Handler.cpp \
    $$PWD/../src/cef/QtBridgeClient.cpp \
    $$PWD/../src/cef/QtBridgeView.cpp

HEADERS += \
    $$PWD/../src/host/CefBootstrap.h \
    $$PWD/../src/host/BridgeBus.h \
    $$PWD/../src/host/BridgeRequest.h \
    $$PWD/../src/host/modules/SystemModule.h \
    $$PWD/../src/host/modules/SidecarModule.h \
    $$PWD/../src/cef/QtBridgeApp.h \
    $$PWD/../src/cef/QtBridgeV8Handler.h \
    $$PWD/../src/cef/QtBridgeClient.h \
    $$PWD/../src/cef/QtBridgeView.h

macx {
    QMAKE_POST_LINK += $$quote(mkdir -p $$shell_path($$OUT_PWD/web) && cp -R $$shell_path($$PWD/../web/) $$shell_path($$OUT_PWD/web/))
}
