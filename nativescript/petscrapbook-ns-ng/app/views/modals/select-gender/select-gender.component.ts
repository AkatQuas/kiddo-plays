import { Component } from '@angular/core';
import { ModalDialogParams } from 'nativescript-angular/modal-dialog';

@Component({
    selector: 'select-gender',
    moduleId: module.id,
    templateUrl: './select-gender.html'
})
export class SelectGenderComponent {
    gender: number;
    genders: Array<String> = ['Female', 'Male', 'Other'];
    constructor(private _params: ModalDialogParams) {
        const index = this.genders.findIndex(el => el === _params.context)
        this.gender = index === -1 ? 0 : index; 
    }

    onDone(): any {
        this._params.closeCallback(this.genders[this.gender]);
    }
}