///<reference path="../../node_modules/@angular/forms/src/form_providers.d.ts"/>
import {BrowserModule} from '@angular/platform-browser';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {NgModule} from '@angular/core';
import {HttpModule} from '@angular/http';

import {InMemoryWebApiModule} from 'angular-in-memory-web-api';
import {InMemoryDataService} from './service/in-memory-data.service';

import {AppComponent} from './app.component';
import {HeroDetailComponent} from './hero/hero-detail.component';
import {HeroesComponent} from './hero/heroes.componet';
import {DashboardComponent} from './dashboard/dashboard.component';
import {HeroService} from './hero/hero.service';

import {AppRoutingModule} from './router/app-routing.module';
import {DatabindingComponent} from './databinding/databinding.component';
import {PropertyBindingComponent} from './databinding/property-binding.component';
import {EventBindingComponent} from './databinding/event-binding.component';
import {TwoWayBindingComponent} from './databinding/two-way-binding.component';
import {LifecycleComponent} from './lifecycle.component';
import {DirectivesComponent} from './directives/directives.component';
import {HighlightDirective} from './directives/highlight.directive';
import {UnlessDirective} from './directives/unless.directive';
import {LogService} from './service/log.service';
import {HeroDetailGuard} from "./hero/hero-detail.guard";
import {HeroEditGuard} from "./hero/hero-edit.guard";
import {WrapperComponent} from './wrapper.component';
import {FormsComponent} from './forms/forms.component';
import {TemplateDrivenComponent} from './forms/template-driven.component';
import {DataDrivenComponent} from './forms/data-driven.component';
import {PipesComponent} from './pipes/pipes.component';
import {DoublePipe} from './pipes/double.pipe';
import {FilterPipe} from './pipes/filter.pipe';
import {HttpService} from "./service/http.service";
import {HttpComponent} from './http/http.component';
import {Intro2ngmoduleComponent} from './intro2ngmodule/intro2ngmodule.component';
import {ProtectedComponent} from './auth/protected.component';
import {SignComponent} from './auth/sign.component';
import {AuthServiceService} from "./service/auth-service.service";
import {AuthGuard} from "./auth/auth.guard";
import {Intro2ngcliComponent} from './intro2ngcli/intro2ngcli.component';

@NgModule({
    declarations: [
        AppComponent,
        HeroesComponent,
        HeroDetailComponent,
        DashboardComponent,
        DatabindingComponent,
        PropertyBindingComponent,
        EventBindingComponent,
        TwoWayBindingComponent,
        LifecycleComponent,
        DirectivesComponent,
        HighlightDirective,
        UnlessDirective,
        WrapperComponent,
        FormsComponent,
        TemplateDrivenComponent,
        DataDrivenComponent,
        PipesComponent,
        DoublePipe,
        FilterPipe,
        HttpComponent,
        Intro2ngmoduleComponent,
        ProtectedComponent,
        SignComponent,
        Intro2ngcliComponent,
    ],
    imports: [
        BrowserModule, FormsModule, AppRoutingModule, HttpModule,
        InMemoryWebApiModule.forRoot(InMemoryDataService), ReactiveFormsModule
    ],
    providers: [HeroService, LogService, HeroDetailGuard, HeroEditGuard, HttpService, AuthServiceService, AuthGuard],
    bootstrap: [AppComponent]
})
export class AppModule {
}
