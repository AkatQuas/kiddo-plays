import {CanDeactivate} from "@angular/router";
import {Observable} from "rxjs/Observable";

export interface ComponentCanDeactivate {
    canDeactivate: () => boolean | Observable<boolean>;
}

export class HeroEditGuard implements CanDeactivate<ComponentCanDeactivate> {
    canDeactivate(component: ComponentCanDeactivate): Observable<boolean> | boolean {
        return component.canDeactivate ? component.canDeactivate() : true;
    }
}
