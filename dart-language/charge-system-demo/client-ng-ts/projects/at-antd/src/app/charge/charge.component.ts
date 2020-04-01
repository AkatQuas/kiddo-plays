import { Component, OnInit } from '@angular/core';
import { Choice, History, ChargeService } from '../charge.service';
import { NzMessageService, NzModalService } from 'ng-zorro-antd';

@Component({
  selector: 'ant-charge',
  templateUrl: './charge.component.html',
  styleUrls: ['./charge.component.less']
})
export class ChargeComponent implements OnInit {
  choices: Choice[] = [];
  histories: History[] = [];

  constructor(
    private chargeService: ChargeService,
    private modalService: NzModalService,
    private message: NzMessageService
  ) { }

  ngOnInit() {
    this.getChoices();
    this.getRecentHistoryBy4();
  }
  getChoices() {
    this.chargeService.getChoices().subscribe(res => this.choices = res);
  }

  confirmCharge(value: number) {
    this.modalService.confirm({
      nzTitle: `<i>Do you want charge $ ${value}?</i>`,
      nzOnOk: () => { this.charge(value); }
    });
  }
  charge(value: number) {
    this.chargeService.postCharge(value).subscribe(res => {
      if (res != null) {
        this.message.create('success','Charged successfully!');
        this.getRecentHistoryBy4();
      }
    });

  }
  getRecentHistoryBy4() {
    this.chargeService.getHistory().subscribe(res => {
      if (res !== null) {
        this.histories = res.splice(0, 4);
      }
    });

  }

}
