import { Component, Input } from '@angular/core';
import { Location } from '@angular/common';

@Component({
  selector: 'ant-back-header',
  templateUrl: './back-header.component.html',
  styleUrls: ['./back-header.component.less']
})
export class BackHeaderComponent {
  @Input()
  title: string;

  constructor(
    private location: Location
  ) { }

  goBack() {
    this.location.back();
  }

}
