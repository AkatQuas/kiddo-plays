import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CrisisService } from './crisis.service';
import { CrisisListComponent } from './crisis-list.component';
import { CrisisDetailComponent } from './crisis-detail.component';
import { CrisisRoutingModule } from './crisis-routing.module';

@NgModule({
    imports: [CommonModule, CrisisRoutingModule],
    declarations: [CrisisListComponent, CrisisDetailComponent],
    providers: [CrisisService]
})
export class CrisisModule {
}
