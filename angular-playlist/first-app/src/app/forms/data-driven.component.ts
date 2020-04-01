import {Component, OnInit} from '@angular/core';
import {FormArray, FormBuilder, FormControl, FormGroup, Validators} from "@angular/forms";
import {Observable} from "rxjs/Observable";

@Component({
    selector: 'app-data-driven',
    templateUrl: './data-driven.component.html',
    styles: [`
        input.ng-invalid {
            border: 1px solid red;
        }
    `]
})
export class DataDrivenComponent implements OnInit {
    myForm: FormGroup;

    genders = ['male', 'female'];

    constructor(private formBuilder: FormBuilder) {

        this.myForm = formBuilder.group({
            userData: formBuilder.group({
                username: ['Max', [Validators.required, this.syncValidator]],
                email: ['test@test.com', [Validators.required, Validators.pattern("[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?")]],
            }),
            password: ['', Validators.required],
            gender: ['male'],
            hobbies: formBuilder.array([
                ['cooking', Validators.required, this.asyncValidator]
            ])
        })
        this.myForm.valueChanges.subscribe(
            (data: any) => {console.log('valueChanges', data)}
        );
        this.myForm.statusChanges.subscribe(
            (data: any) => {console.log('statusChanges', data)}
        );
    }


    // The first arg in FormControl is a default value for the key, the second is an array of some validator functions.

    ngOnInit() {
        // this.myForm = new FormGroup({
        //     userData: new FormGroup({
        //         username: new FormControl('Max', [Validators.required, this.syncValidator]),
        //         email: new FormControl('test@test.com', [Validators.required, Validators.pattern("[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?")]),
        //     }),
        //     password: new FormControl('', Validators.required),
        //     gender: new FormControl('male'),
        //     hobbies: new FormArray([
        //         new FormControl('cooking', Validators.required, this.syncValidator)
        //     ])
        // });
    }

    onAddHobby() {
        (<FormArray>this.myForm.controls['hobbies']).push(new FormControl('', Validators.required));
    }

    onDeleteHobby(idx) {
        (<FormArray>this.myForm.controls['hobbies']).removeAt(idx);
    }

    onSubmit() {
        console.log(this.myForm)
    }

    syncValidator(control: FormControl): { [s: string]: boolean } {
        if (control.value === 'example') {
            return {invalid: true};
        }
        return null;
    }

    asyncValidator(control: FormControl): Promise<any> | Observable<any> {
        return new Promise<any>(
            (resolve, reject) => {
                setTimeout(_ => {
                    if (control.value === 'async') {
                        resolve({'invalid': true});
                    } else {
                        resolve(null);
                    }
                }, 1500)
            }
        );
    }

}
