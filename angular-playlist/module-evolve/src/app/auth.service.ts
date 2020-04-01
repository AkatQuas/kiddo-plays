import { Injectable } from '@angular/core';

import { Observable } from 'rxjs/observable';
import { of } from 'rxjs/observable/of';
import { delay, tap } from 'rxjs/operators';
@Injectable()
export class AuthService {
  _logged: boolean = false;
  get isLoggedIn() {
    console.log('get attr', this._logged);
    return this._logged;
  }
  set isLoggedIn (val:boolean) {
    console.log('setting _logged with ' + val) 
    this._logged = val;
  }
  redirectUrl: string;
  login(): Observable<boolean> { 
    //todo assignment
    return of(true).pipe(tap(val => this._logged = !!val),delay(1000)); 
  }
  logout(): void {
    this.isLoggedIn = false;
  }
  constructor() { }

}
