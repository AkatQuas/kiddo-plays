cmake_minimum_required(VERSION 3.16)

project(alarm VERSION 0.1 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(QT_QML_GENERATE_QMLLS_INI ON)

find_package(Qt6 REQUIRED COMPONENTS Core Gui Quick QuickControls2)

qt_standard_project_setup(REQUIRES 6.8)

qt_add_executable(appalarm
    main.cpp
)

qt_add_qml_module(appalarm
    URI alarm
    SOURCES
        main.cpp
    QML_FILES
        Main.qml
        AlarmDialog.qml
        AlarmDelegate.qml
        AlarmModel.qml
        TumblerDelegate.qml
)

qt_add_resources(appalarm "controls_conf"
    PREFIX
        "/"
    FILES
        "qtquickcontrols2.conf"
)

# Qt for iOS sets MACOSX_BUNDLE_GUI_IDENTIFIER automatically since Qt 6.1.
# If you are developing for iOS or macOS you should consider setting an
# explicit, fixed bundle identifier manually though.
set_target_properties(appalarm PROPERTIES
    MACOSX_BUNDLE_GUI_IDENTIFIER com.example.appalarm
    MACOSX_BUNDLE_BUNDLE_VERSION ${PROJECT_VERSION}
    MACOSX_BUNDLE_SHORT_VERSION_STRING ${PROJECT_VERSION_MAJOR}.${PROJECT_VERSION_MINOR}
    MACOSX_BUNDLE TRUE
    WIN32_EXECUTABLE TRUE
)

target_link_libraries(appalarm PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::QuickControls2
    Qt6::Quick
)

qt_generate_deploy_qml_app_script(
    TARGET appalarm
    OUTPUT_SCRIPT deploy_script
    MACOS_BUNDLE_POST_BUILD
    NO_UNSUPPORTED_PLATFORM_ERROR
    DEPLOY_USER_QML_MODULES_ON_UNSUPPORTED_PLATFORM
)

install(TARGETS appalarm
    BUNDLE DESTINATION .
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)
