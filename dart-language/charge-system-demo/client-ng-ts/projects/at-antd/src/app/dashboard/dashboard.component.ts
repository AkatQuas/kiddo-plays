import { Component, OnInit } from '@angular/core';
import { UserService } from '../user.service';
import { Router } from '@angular/router';

@Component({
  selector: 'ant-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.less']
})
export class DashboardComponent implements OnInit {
  username: string = '';

  constructor(
    private userService: UserService,
    private router:Router
  ) { }

  ngOnInit() {
    this.username = this.userService.getCurrentUser();
  }
  navHistory() {
    this.router.navigateByUrl('/history');
  }
  navCharge() {
    this.router.navigateByUrl('/charge');
  }
  logOut() {
    this.userService.logout();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
