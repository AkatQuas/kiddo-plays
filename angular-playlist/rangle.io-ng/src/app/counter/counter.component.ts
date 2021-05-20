import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';

@Component({
  selector: 'app-counter',
  templateUrl: './counter.component.html',
  styleUrls: ['./counter.component.less'],
})
export class CounterComponent implements OnChanges {
  @Input() count = 0;
  @Output() tick = new EventEmitter<number>();

  ngOnChanges(changes: SimpleChanges): void {
    console.log(`xedlog counter change ->`, changes);
  }

  increment(): void {
    this.count++;
    this.tick.emit(this.count);
    console.log(`xedlog this.count ->`, this.count);
  }
}
