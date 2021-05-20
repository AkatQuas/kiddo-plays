import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';

@Component({
  selector: 'app-counter-change',
  templateUrl: './counter-change.component.html',
  styleUrls: ['./counter-change.component.less'],
})
export class CounterChangeComponent implements OnChanges {
  @Input() count = 0;
  @Output() countChange = new EventEmitter<number>();
  age = 2;
  ngOnChanges(changes: SimpleChanges): void {
    console.log(
      `counter-change changes ->`,
      changes.count?.currentValue,
      changes.count?.previousValue
    );
  }

  increment(): void {
    this.countChange.emit(this.count + 1);
  }
}
