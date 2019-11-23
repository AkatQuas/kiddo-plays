import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormControl, FormGroup, Validators} from "@angular/forms";
import {AuthServiceService} from "../service/auth-service.service";
import {User} from "../service/user";

@Component({
    selector: 'app-sign',
    templateUrl: './sign.component.html',
    styles: []
})
export class SignComponent implements OnInit {
    myForm: FormGroup;
    error = false;
    errorMessage = '';
    sign_users: User[] = [];
    auth_users: User[] = [];

    constructor(private fb: FormBuilder,
                private authService: AuthServiceService) {
    }

    ngOnInit() {
        this.myForm = this.fb.group({
            email: ['', Validators.compose([
                Validators.required,
                this.isEmail
            ])],
            password: ['', Validators.required],
            confirmPassword: ['', Validators.compose([
                Validators.required,
                this.isEqualPassword.bind(this)
            ])],
        });
        this.getSignedUsers()
        this.getAuthedUsers()
    }

    onSignup() {
        const user = {
            email: this.myForm.value.email,
            password: this.myForm.value.password
        }
        this.authService.signUp(user);
        this.getSignedUsers()
    }

    onSignin() {
        const user = {
            email: this.myForm.value.email,
            password: this.myForm.value.password
        };
        this.authService.signIn(user);
        this.getAuthedUsers()
    }
    onLogout() {
        const user = {
            email: this.myForm.value.email,
            password: this.myForm.value.password
        };
        this.authService.logOut(user);
        this.getAuthedUsers()
    }

    isEmail(control: FormControl): { [s: string]: boolean } {
        if (!control.value.match(/^\w+@[a-zA-Z_]+?\.[a-zA-Z]{2,3}$/)) {
            return {noEmail: true};
        }
    }

    isEqualPassword(control: FormControl): { [s: string]: boolean } {
        if (!this.myForm) {
            return {passwordNotMatch: true};
        }
        if (control.value !== this.myForm.controls['password'].value) {
            return {passwordNotMatch: true};
        }
    }

    private getSignedUsers() {
        this.sign_users = this.authService.fetchSignedUser();
    }
    private getAuthedUsers() {
        this.auth_users = this.authService.fetchAuthedUser();
    }
}
