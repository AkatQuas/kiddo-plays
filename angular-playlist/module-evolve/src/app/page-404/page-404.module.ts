import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Page404Component } from './page-404.component';
import { RouterModule } from '@angular/router';

const routes = [
    { path: '**', component: Page404Component }
];

@NgModule({
    imports: [
        CommonModule,
        RouterModule.forChild(routes)
    ],
    exports: [RouterModule],
    declarations: [Page404Component]
})
export class Page404Module {
}
