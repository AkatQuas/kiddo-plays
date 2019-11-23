import {Component, OnInit} from '@angular/core';
import {Router} from "@angular/router";
import {APP_ROUTES} from "./router/app-routing.module";

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']

})
export class AppComponent implements OnInit {
    title = 'Tour of Heroes';
    navs = null;

    constructor(private router: Router) {
    }

    ngOnInit() {
        this.navs = APP_ROUTES.filter(v => v.path !== '').map(v => ['/' + v.path]);
    }

    onNav() {
        this.router.navigate(['heroes']);
    }
}
