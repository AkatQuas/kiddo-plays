import QtQuick

// Populate the model with some sample data.
ListModel {
    id: alarmModel

    ListElement {
        hour: 6
        minute: 0
        day: 2
        month: 8
        year: 2026
        activated: true
        label: "Wake up"
        repeat: true
        daysToRepeat: [
            ListElement { dayOfWeek: 0; repeat: false },
            ListElement { dayOfWeek: 1; repeat: false },
            ListElement { dayOfWeek: 2; repeat: false },
            ListElement { dayOfWeek: 3; repeat: false },
            ListElement { dayOfWeek: 4; repeat: false },
            ListElement { dayOfWeek: 5; repeat: false },
            ListElement { dayOfWeek: 6; repeat: false }
        ]
    }
    ListElement {
        hour: 8
        minute: 0
        day: 3
        month: 8
        year: 2026
        activated: true
        label: "Eat breakfast"
        repeat: true
        daysToRepeat: [
            ListElement { dayOfWeek: 0; repeat: true },
            ListElement { dayOfWeek: 1; repeat: true },
            ListElement { dayOfWeek: 2; repeat: true },
            ListElement { dayOfWeek: 3; repeat: true },
            ListElement { dayOfWeek: 4; repeat: true },
            ListElement { dayOfWeek: 5; repeat: false },
            ListElement { dayOfWeek: 6; repeat: false }
        ]
    }
    ListElement {
        hour: 7
        minute: 0
        day: 3
        month: 8
        year: 2026
        activated: false
        label: "Exercise"
        repeat: true
        daysToRepeat: [
            ListElement { dayOfWeek: 0; repeat: true },
            ListElement { dayOfWeek: 1; repeat: true },
            ListElement { dayOfWeek: 2; repeat: true },
            ListElement { dayOfWeek: 3; repeat: true },
            ListElement { dayOfWeek: 4; repeat: true },
            ListElement { dayOfWeek: 5; repeat: true },
            ListElement { dayOfWeek: 6; repeat: true }
        ]
    }
    ListElement {
        hour: 5
        minute: 15
        day: 1
        month: 9
        year: 2018
        activated: true
        label: ""
        repeat: false
        daysToRepeat: [
            ListElement { dayOfWeek: 0; repeat: false },
            ListElement { dayOfWeek: 1; repeat: false },
            ListElement { dayOfWeek: 2; repeat: false },
            ListElement { dayOfWeek: 3; repeat: false },
            ListElement { dayOfWeek: 4; repeat: false },
            ListElement { dayOfWeek: 5; repeat: false },
            ListElement { dayOfWeek: 6; repeat: false }
        ]
    }
    ListElement {
        hour: 5
        minute: 45
        day: 3
        month: 9
        year: 2018
        activated: false
        label: ""
        repeat: false
        daysToRepeat: [
            ListElement { dayOfWeek: 0; repeat: false },
            ListElement { dayOfWeek: 1; repeat: false },
            ListElement { dayOfWeek: 2; repeat: false },
            ListElement { dayOfWeek: 3; repeat: false },
            ListElement { dayOfWeek: 4; repeat: false },
            ListElement { dayOfWeek: 5; repeat: false },
            ListElement { dayOfWeek: 6; repeat: false }
        ]
    }
}