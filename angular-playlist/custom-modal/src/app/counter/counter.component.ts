import { Component, OnInit, Input, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-counter',
  templateUrl: './counter.component.html',
  styleUrls: ['./counter.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CounterComponent implements OnInit {
  @Input() fireStream: Observable<any>;
  counter: number = 0;

  constructor(
    private cd: ChangeDetectorRef,
  ) { }

  ngOnInit() {
    this.fireStream.subscribe(() => {
      this.counter += 1;
      // `OnPush` strategy means we have to
      // trigger change detection manually
      this.cd.markForCheck();
    });
  }

}
