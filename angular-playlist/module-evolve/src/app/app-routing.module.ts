import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ContactModule } from './contact/contact.module';
import { AuthGuard } from './auth-guard.service';
import { SelectivePreloadingStrategy } from './selective-preloading-strategy';

const routes: Routes = [
    { path: '', redirectTo: 'contact', pathMatch: 'full' },
    { path: 'crisis', loadChildren: 'app/crisis/crisis.module#CrisisModule', data: { preload: true } },
    { path: 'heroes', loadChildren: 'app/hero/hero.module#HeroModule' },
    { path: 'admin', loadChildren: 'app/admin/admin.module#AdminModule', canLoad: [AuthGuard]}
];

@NgModule({
    imports: [
        ContactModule,
        RouterModule.forRoot(routes, {
            preloadingStrategy: SelectivePreloadingStrategy
        })
    ],
    exports: [RouterModule],
    providers: [SelectivePreloadingStrategy]
})
export class AppRoutingModule {
}
