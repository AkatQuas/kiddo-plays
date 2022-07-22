import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { AboutRoutingModule } from './about-routing.module';

import { SharedModule } from '../shared/shared.module';
import { AboutComponent } from './about.component';

@NgModule({
  declarations: [AboutComponent],
  imports: [CommonModule, SharedModule, AboutRoutingModule],
})
export class AboutModule {}
