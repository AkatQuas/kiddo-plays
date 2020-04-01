import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-admin',
  template: `
  <h3>ADMIN</h3>
  <nav>
  <a routerLink="./" routerLinkActive="active"
  [routerLinkActiveOptions]="{ exact: true }">Dashboard</a>
<a routerLink="./crises" routerLinkActive="active">Manage Crises</a>
<a routerLink="./heroes" routerLinkActive="active">Manage Heroes</a>
  </nav>
  <router-outlet></router-outlet>
  `,
  styles: []
})
export class AdminComponent implements OnInit {

  constructor() { }

  ngOnInit() {
    console.log('admin here')
  }

}
