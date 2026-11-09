# CEF subprocess binary (Renderer / GPU / Plugin helpers share this image).
QT -= gui
QT += core
CONFIG += c++17 console
CONFIG -= app_bundle
TEMPLATE = app
TARGET = qtbridge-helper

include($$PWD/../cef.pri)
INCLUDEPATH += $$PWD/../src

SOURCES += \
    $$PWD/helper_main.cpp \
    $$PWD/../src/cef/QtBridgeApp.cpp \
    $$PWD/../src/cef/QtBridgeV8Handler.cpp

HEADERS += \
    $$PWD/../src/cef/QtBridgeApp.h \
    $$PWD/../src/cef/QtBridgeV8Handler.h
