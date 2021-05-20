import { Component, OnDestroy, OnInit } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less'],
})
export class AppComponent implements OnInit, OnDestroy {
  directions = ['east', 'west', 'north', 'south', 'no-direction'];
  myDir = this.directions[0];
  dir$: Subscription;
  count = 0;
  title = 'rangle.io';
  genders = ['male', 'female', 'other'];
  gender = 'male';
  created_by = $localize`Created by ${this.gender}`;
  num = 0;
  parentCount = 0;
  numChange = 2;
  ngOnInit(): void {
    this.dir$ = interval(1000)
      .pipe(
        tap(() => {
          const added = this.count + 1;
          this.count = added % this.directions.length;
          this.gender = this.genders[added % this.genders.length];
          this.created_by = $localize`Created by ${this.gender}`;
          this.myDir = this.directions[this.count];
        })
      )
      .subscribe();
  }
  ngOnDestroy(): void {
    this.dir$?.unsubscribe();
  }

  ngOnChange(val: number): void {
    this.parentCount = val;
    console.log(`xedlog this.num ->`, this.num);
    // this.num = val + 2;
  }

  trackByDirection(i: number, direction: string): string {
    return direction;
  }
}
