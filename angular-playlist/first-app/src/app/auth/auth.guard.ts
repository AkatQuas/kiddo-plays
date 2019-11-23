import {Injectable} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivate, RouterStateSnapshot} from '@angular/router';
import {Observable} from 'rxjs/Observable';
import {AuthServiceService} from "../service/auth-service.service";

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private authService: AuthServiceService) {
    }

    canActivate(next: ActivatedRouteSnapshot,
                state: RouterStateSnapshot): Observable<boolean> | Promise<boolean> | boolean {
        const auth = this.authService.getToken()
        if (auth) {
            return auth;
        } else {
            alert('no allowed!')
            return auth;
        }
    }
}
