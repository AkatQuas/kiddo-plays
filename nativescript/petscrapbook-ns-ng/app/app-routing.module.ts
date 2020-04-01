import { NativeScriptRouterModule } from 'nativescript-angular/router';
import { NgModule } from '@angular/core';
import { Routes } from '@angular/router';

import { HomeComponent } from "./views/home/home.component";
import { ListComponent } from "./views/list/list.component";
import { AboutComponent } from './views/about/about.component';
import { DetailComponent } from './views/detail/detail.component';

export const routes: Routes = [
    { path: '', redirectTo: 'home', pathMatch: 'full' },
    { path: 'home', component: HomeComponent },
    { path: 'list', component: ListComponent },
    { path: 'about', component: AboutComponent },
    { path: 'detail/:id', component: DetailComponent }
]

export const navigatableComponents: any = [
    HomeComponent,
    ListComponent,
    AboutComponent,
    DetailComponent
]

@NgModule({
    imports: [NativeScriptRouterModule.forRoot(routes)],
    exports: [NativeScriptRouterModule]
})
export class AppRoutingModule {

}