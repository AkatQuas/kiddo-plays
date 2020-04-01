import {Component, OnInit} from '@angular/core';
import {NgForm} from "@angular/forms";

@Component({
    selector: 'app-template-driven',
    templateUrl: './template-driven.component.html',
    styles: [`
        input.ng-invalid {
            border: 1px solid red;
        }
    `]
})
export class TemplateDrivenComponent implements OnInit {
    user = {
        username: 'Max',
        email: 'test@test.com',
        password: 'test',
        gender: 'female'
    }
    genders = [
        'male', 'female'
    ]

    constructor() {
    }

    ngOnInit() {
    }

    onSubmit(form: NgForm) {
        console.log('full form instance', form)
        console.log('value in the form instance', form.value)
        console.log('Object user', this.user)
    }

}
