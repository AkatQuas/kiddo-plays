import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { HousingDetailComponent } from './housing-detail/housing-detail.component';

export const routeConfig: Routes = [
  {
    path: '',
    component: HomeComponent,
    title: 'Home Page',
  },
  {
    path: 'details/:id',
    component: HousingDetailComponent,
    title: 'Home details',
  },
];
