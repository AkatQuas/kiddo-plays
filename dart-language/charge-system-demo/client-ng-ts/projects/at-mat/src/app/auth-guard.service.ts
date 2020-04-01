import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuardService implements CanActivate {

  constructor(private userService: UserService, private router: Router) { }

  canActivate(): boolean {
    const isAuthed = this.userService.isAuthed();
    if (isAuthed) {
      return true;
    }
    this.router.navigate(['/login'], { replaceUrl: true });
    return false;
  }
}
