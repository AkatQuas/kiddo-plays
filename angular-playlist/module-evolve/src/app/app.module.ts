import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';

import { AppRoutingModule } from './app-routing.module';
import { CoreModule } from './core/core.module';
import { Page404Module } from './page-404/page-404.module';
import { LoginComponent } from './login.component';
import { LoginRoutingModule } from './login-routing.module';
import { Router } from '@angular/router';

@NgModule({
    declarations: [
        AppComponent,
        LoginComponent
    ],
    imports: [
        BrowserModule, AppRoutingModule, CoreModule.forRoot({ userName: 'Miss Marple' }), LoginRoutingModule, Page404Module

    ],
    providers: [],
    bootstrap: [AppComponent]
})
export class AppModule {
    constructor(router: Router) {
        console.log('Routes: ', JSON.stringify(router.config,undefined,2))
    }
}
