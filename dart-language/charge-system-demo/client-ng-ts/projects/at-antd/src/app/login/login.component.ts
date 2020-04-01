import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../user.service';
import { NzMessageService } from 'ng-zorro-antd';

@Component({
  selector: 'ant-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.less']
})
export class LoginComponent {
  username: string = '';
  password: string = '';

  constructor(
    private router: Router,
    private message: NzMessageService,
    private userService: UserService
  ) { }

  toDashboard(): void {
    this.router.navigateByUrl('/dashboard');
  }
  handleLogin() {
    const { username, password } = this;
    if (username === '' || password === '') {
      return this.message.create('error', 'username or password can not be empty');
    }
    this.userService.login(username, password).subscribe((res) => {
      if (res) { this.toDashboard(); }
    });
  }

}
