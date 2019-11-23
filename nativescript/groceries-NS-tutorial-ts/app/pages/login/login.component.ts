import { Component, OnInit, ElementRef, ViewChild } from "@angular/core";
import { User } from '../../shared/user/user';
import { UserService } from '../../shared/user/user.service';
import { Router } from '@angular/router';
import { Page } from 'ui/page';
import { Color } from 'color';
import { View } from 'ui/core/view';
import { setHintColor } from '../../utils/hint-util';
import { TextField } from 'ui/text-field';

@Component({
  selector: "my-app",
  moduleId: module.id,
  providers: [UserService],
  templateUrl: './login.html',
  styleUrls: ["./login-common.css", './login.css']
})

export class LoginComponent implements OnInit {
  user: User;
  isLoggingIn: boolean = true;
  @ViewChild('container') container: ElementRef;
  @ViewChild('email') email: ElementRef;
  @ViewChild('password') password: ElementRef;

  constructor(private router:Router, private userService: UserService, private page: Page) {
    this.user = new User();
    this.user.email = "my.test.account@nativescript.org";
    this.user.password = "password";
  }


  submit() {
    if (!this.user.isValidEmail()) {
       alert("Email address not valid");
       return;
    }
    if (this.isLoggingIn) {
      this.login();
    } else {
      this.signUp();
    }
  }
  login() {
    this.userService.login(this.user).subscribe(_ => this.router.navigate(['/list']), err => alert('Failed to login!')
    )
  }
  signUp() {
    this.userService.register(this.user).subscribe(_ => {
      alert('Your account ok!');
      this.toggleDisplay(); 
    }, _ => {
      alert('Failed to create the account!')
    });
  }

  toggleDisplay(): void { 
    this.isLoggingIn = !this.isLoggingIn;
    const container = <View>this.container.nativeElement;
    container.animate({ 
      backgroundColor: this.isLoggingIn ? new Color('white') : new Color('#301217'),
      duration: 200
    })
    this.setTextFieldColors();
  }

  setTextFieldColors() {
    let emailTextField = <TextField>this.email.nativeElement;
    let passwordTextField = <TextField>this.password.nativeElement;

    let mainTextColor = new Color(this.isLoggingIn ? 'black' : '#C4AFB4');
    emailTextField.color = mainTextColor;
    passwordTextField.color = mainTextColor;

    let hintColor = new Color(this.isLoggingIn? '#ACA6A7' : '#C4AFB4')
    setHintColor({ view: emailTextField, color: hintColor});
    setHintColor({ view: passwordTextField, color: hintColor});
  }

  ngOnInit() {
    this.page.actionBarHidden = true;
    this.page.backgroundImage = 'res://bg_login';
  }
}