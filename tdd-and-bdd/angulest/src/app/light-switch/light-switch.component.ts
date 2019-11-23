import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-light-switch',
  templateUrl: './light-switch.component.html',
  styleUrls: ['./light-switch.component.less']
})
export class LightSwitchComponent implements OnInit {
  isOn: boolean = false;
  message: string = 'is off';
  constructor() { }

  ngOnInit() {
  }

  clicked(): void {
    const { isOn } = this;
    this.isOn = !isOn;
    this.message = isOn ? 'is off' : 'is on';
  }

}
