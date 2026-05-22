pragma ComponentBehavior: Bound

import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material

ApplicationWindow {
    id: window
    width: 400
    height: 500
    visible: true
    title: qsTr("Hello Alarm")

    // Load the alarm model with data
    AlarmModel {
        id: alarmModel
    }

    // combines the data from `alarmModel`
    // with the layout defined in `alarmDelegate`
    ListView {
        id: alarmListView
        anchors.fill: parent
        model: alarmModel
        delegate: AlarmDelegate {}
    }

    // Click `AlarmButton` to open a Dialog screen `alarmDialog`.
    RoundButton {
        id: addAlarmButton
        text: "+"
        anchors.bottom: alarmListView.bottom
        anchors.bottomMargin: 8
        anchors.horizontalCenter: parent.horizontalCenter
        onClicked: alarmDialog.open()
    }

     AlarmDialog {
        id: alarmDialog
        x: Math.round((parent.width - width) / 2)
        y: Math.round((parent.height - height) / 2)
        alarmModel: alarmListView.model
    }
}
