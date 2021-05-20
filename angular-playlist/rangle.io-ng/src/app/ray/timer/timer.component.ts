import { Component, OnDestroy, OnInit } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RandomService } from '../random.service';

@Component({
  selector: 'ray-timer',
  templateUrl: './timer.component.html',
  styleUrls: ['./timer.component.less'],
})
export class TimerComponent implements OnInit, OnDestroy {
  random: string;
  timer = 0;
  timer$: Subscription;
  constructor(private randomSrv: RandomService) {}
  ngOnInit(): void {
    this.timer$ = interval(1000)
      .pipe(
        tap(() => {
          this.timer += 1;
          this.random = this.randomSrv.getRandom();
        })
      )
      .subscribe();
  }
  ngOnDestroy(): void {
    this.timer$.unsubscribe();
  }
}
