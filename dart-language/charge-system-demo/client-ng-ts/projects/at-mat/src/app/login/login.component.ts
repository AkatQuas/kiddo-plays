import { Component } from '@angular/core';
import { MatSnackBar } from '@angular/material';
import { Router } from '@angular/router';
import { UserService } from '../user.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.less'],
})
export class LoginComponent {
  username: string = '';
  password: string = '';
  constructor(
    private userService: UserService,
    private snackBar: MatSnackBar,
    private router: Router
  ) { }

  toDashboard(): void {
    this.router.navigateByUrl('/dashboard');
  }

  handleLogin() {
    const { username, password } = this;
    if (username === '' || password === '') {
      return this.snackBar.open('username or password can not be empty', '', {
        verticalPosition: 'top',
        duration: 1500
      });
    }
    this.userService.login(username, password).subscribe((res) => {
      if (res) { this.toDashboard(); }
    });
  }

}
