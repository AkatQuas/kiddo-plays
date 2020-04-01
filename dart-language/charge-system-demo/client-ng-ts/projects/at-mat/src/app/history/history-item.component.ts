import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-history-item',
  templateUrl: './history-item.component.html',
  styleUrls: ['./history-item.component.less']
})
export class HistoryItemComponent  {
  @Input()
  time: string;

  @Input()
  value: number;
}
