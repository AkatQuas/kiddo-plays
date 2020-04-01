import { Injectable } from '@angular/core';

export interface IUser {
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  isLoggedIn: boolean = false;

  user: IUser = {
    name: 'I am Iron-Man',
  }

  constructor() { }

  login() {
    this.isLoggedIn = true;
  }

  logout() {
    this.isLoggedIn = false;
  }
}
