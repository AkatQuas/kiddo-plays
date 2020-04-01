import {Component, EventEmitter, OnInit, Output} from '@angular/core';

@Component({
    selector: 'app-event-binding',
    template: `
        <button (click)="onClicked()">click me !</button>
    `,
    styles: []
})
export class EventBindingComponent implements OnInit {

    @Output() clicked = new EventEmitter<string>()

    // @Output('clickable') clicked = new EventEmitter<string>() //clickable could be the event word used in upper component

    constructor() {
    }

    ngOnInit() {
    }

    onClicked() {
        alert('clicked you!')
        this.clicked.emit('It works');
    }

}
