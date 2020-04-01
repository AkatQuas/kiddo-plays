import { Component } from '@angular/core';
import { ModalDialogParams } from 'nativescript-angular/modal-dialog';

@Component({
    // moduleId: module.id,
    selector: 'select-date',
    templateUrl: 'views/modals/select-date/select-date.html'
})
export class SelectDateComponent {
    date: any;
    constructor(private _params: ModalDialogParams) { 
        const date = new Date(_params.context)
        this.date = date;
    }

    onDone(): any {
        console.log(new Date(this.date).getTime())
        this._params.closeCallback(this.date);
    }
}