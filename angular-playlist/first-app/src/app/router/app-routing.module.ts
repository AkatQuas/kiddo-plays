import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';

import {HeroDetailComponent} from '../hero/hero-detail.component';
import {HeroesComponent} from '../hero/heroes.componet';
import {DashboardComponent} from '../dashboard/dashboard.component';
import {HeroDetailGuard} from "../hero/hero-detail.guard";
import {HeroEditGuard} from "../hero/hero-edit.guard";
import {WrapperComponent} from "../wrapper.component";
import {FormsComponent} from "../forms/forms.component";
import {PipesComponent} from "../pipes/pipes.component";
import {HttpComponent} from "../http/http.component";
import {Intro2ngmoduleComponent} from "../intro2ngmodule/intro2ngmodule.component";
import {ProtectedComponent} from "../auth/protected.component";
import {SignComponent} from "../auth/sign.component";
import {AuthGuard} from "../auth/auth.guard";
import {Intro2ngcliComponent} from "../intro2ngcli/intro2ngcli.component";
// import {CHILD_ROUTES} from "./app-routing-child.module"
// remember to render the child component in the parent component using <router-outlet>
export const APP_ROUTES: Routes = [
    {path: 'dashboard', component: DashboardComponent},
    {path: '', redirectTo: '/dashboard', pathMatch: 'full'},
    // redirect the route, using the pathMatch: 'full' so that only the specified route will be redirected
    {
        path: 'detail/:id',
        component: HeroDetailComponent,
        canActivate: [HeroDetailGuard],
        canDeactivate: [HeroEditGuard]
    },
    // {path: 'heroes', component: HeroesComponent, children: CHILD_ROUTES}
    {path: 'heroes', component: HeroesComponent},
    {path: '1stwrapper', component: WrapperComponent},
    {path: 'forms', component: FormsComponent},
    {path: 'pipes', component: PipesComponent},
    {path: 'http', component: HttpComponent},
    {path: 'intro2ngmodule', component: Intro2ngmoduleComponent},
    {path: 'sign', component: SignComponent},
    {path: 'protected', component: ProtectedComponent, canActivate: [AuthGuard]},
    {path: 'intro2ngcli', component: Intro2ngcliComponent },
    {path: '**', redirectTo: '/dashboard'}
];

@NgModule({
    imports: [RouterModule.forRoot(APP_ROUTES)],
    exports: [RouterModule]
})

export class AppRoutingModule {
}
