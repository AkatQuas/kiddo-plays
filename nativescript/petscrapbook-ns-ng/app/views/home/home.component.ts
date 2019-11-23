import { Component } from '@angular/core';
import { RouterExtensions } from 'nativescript-angular/router';

@Component({
  // selector: 'home',
  moduleId: module.id,
  templateUrl: `./home.html`,
  styleUrls: ['./home.css']
})
export class HomeComponent {

  constructor(private _router: RouterExtensions) {

  }

  onContinueTap(): void {
    this._router.navigate(['list'])
  }

  logIt(msg: string): void {
    console.log(msg);
  }
}