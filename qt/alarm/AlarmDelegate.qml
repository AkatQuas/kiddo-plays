pragma ComponentBehavior: Bound

import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material
import QtQuick.Layouts

ItemDelegate {
    id: root
    width: ListView.view ? ListView.view.width : 0
    checkable: true
    checked: ListView.view ? ListView.view.currentIndex === index : false

    required property int index
    required property int hour
    required property int minute
    required property int day
    required property int month
    required property int year
    required property bool activated
    required property string label
    required property bool repeat
    required property var daysToRepeat

    onClicked: {
        if (ListView.view)
            ListView.view.currentIndex = index
    }

    function deleteAlarm() {
        const listView = ListView.view
        if (!listView)
            return

        listView.model.remove(index, 1)

        if (listView.currentIndex >= listView.count)
            listView.currentIndex = listView.count > 0 ? listView.count - 1 : -1
    }

    contentItem: ColumnLayout {
        width: root.availableWidth
        spacing: 4

        RowLayout {
            Layout.fillWidth: true
            spacing: 8

            ColumnLayout {
                id: dateColumn
                spacing: 0

                readonly property date alarmDate: new Date(
                    root.year, root.month - 1, root.day, root.hour, root.minute)

                Label {
                    font.pixelSize: root.font.pixelSize * 2
                    color: Material.foreground
                    text: dateColumn.alarmDate.toLocaleTimeString(Qt.locale(), Locale.ShortFormat)
                }
                RowLayout {
                    spacing: 8
                    Label {
                        color: Material.foreground
                        text: dateColumn.alarmDate.toLocaleDateString(Qt.locale(), Locale.ShortFormat)
                    }
                    Label {
                        color: Material.foreground
                        text: root.label
                        visible: root.label.length > 0 && !root.checked
                    }
                }
            }

            Item {
                Layout.fillWidth: true
            }

            Switch {
                checked: root.activated
                Layout.alignment: Qt.AlignTop
                onToggled: root.activated = checked
            }
        }

        CheckBox {
            text: qsTr("Repeat")
            checked: root.repeat
            visible: root.checked
            onToggled: root.repeat = checked
        }

        Flow {
            Layout.fillWidth: true
            visible: root.checked && root.repeat

            Repeater {
                model: root.daysToRepeat
                delegate: RoundButton {
                    required property int dayOfWeek
                    required property bool repeat
                    text: Qt.locale().dayName(dayOfWeek, Locale.NarrowFormat)
                    flat: true
                    checked: repeat
                    checkable: true
                    Material.background: checked ? Material.accent : "transparent"
                    onToggled: repeat = checked
                }
            }
        }

        TextField {
            Layout.fillWidth: true
            placeholderText: qsTr("Enter description here")
            visible: root.checked
            text: root.label
            onTextEdited: root.label = text
        }

        Label {
            Layout.fillWidth: true
            visible: root.checked
            text: qsTr("Delete")
            color: Material.color(Material.Red)
            font.underline: true

            MouseArea {
                anchors.fill: parent
                cursorShape: Qt.PointingHandCursor
                onClicked: root.deleteAlarm()
            }
        }
    }
}
