import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RandomService } from './random.service';
import { TimerComponent } from './timer/timer.component';

@NgModule({
  declarations: [TimerComponent],
  imports: [CommonModule],
  exports: [TimerComponent],
  providers: [RandomService],
})
export class RayModule {}
