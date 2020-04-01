import { Component, OnInit } from '@angular/core';
import { ChargeService, History } from '../charge.service';

@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.less']
})
export class HistoryComponent implements OnInit {
  histories: History[] = [];

  constructor(private chargeService: ChargeService) { }

  ngOnInit() {
    this.getHistory();
  }
  getHistory() {
    this.chargeService.getHistory().subscribe(res => {
      if (res) {
        this.histories = res;
      }
    });
  }

}
