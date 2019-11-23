import {Component, OnInit} from '@angular/core';

@Component({
    selector: 'app-two-way-binding',
    template: `
        <input type="text" [(ngModel)]="person.name">
        <input type="text" [(ngModel)]="person.age">
        <p><span>{{person.name}}</span> - <span>{{person.age}}</span></p>
    `,
    styles: []
})
export class TwoWayBindingComponent implements OnInit {

    person = {
        name: 'Max',
        age: 27
    }

    constructor() {
    }

    ngOnInit() {
    }

}
