import {ActivatedRouteSnapshot, CanActivate, RouterStateSnapshot} from "@angular/router"
import {Observable} from "rxjs/Observable";

export class HeroDetailGuard implements CanActivate {
    canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> | boolean {
        return confirm('are you sure?')
    }
}
