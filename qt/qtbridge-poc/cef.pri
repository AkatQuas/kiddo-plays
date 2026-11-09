# Pinned CEF tree from scripts/fetch-cef.sh (override with CEF_ROOT).
isEmpty(CEF_ROOT) {
    CEF_ROOT = $$(CEF_ROOT)
}
isEmpty(CEF_ROOT) {
    CEF_ROOT = $$PWD/third_party/cef
}

!exists($$CEF_ROOT/include/cef_app.h) {
    error("CEF headers missing at $$CEF_ROOT — run ./scripts/fetch-cef.sh")
}

INCLUDEPATH += $$CEF_ROOT
LIBS += -L$$CEF_ROOT/Release -lcef_dll_wrapper

macx {
    LIBS += -framework CoreFoundation -framework AppKit -framework Cocoa
    LIBS += -F$$CEF_ROOT/Release -framework "Chromium Embedded Framework"
    QMAKE_RPATHDIR += @executable_path/../Frameworks
    QMAKE_RPATHDIR += @loader_path/../Frameworks
    QMAKE_LFLAGS += -Wl,-rpath,@executable_path/../Frameworks
}

DEFINES += QTBRIDGE_POC
DEFINES += QTBRIDGE_POC_SOURCE_DIR=\\\"$$PWD\\\"
