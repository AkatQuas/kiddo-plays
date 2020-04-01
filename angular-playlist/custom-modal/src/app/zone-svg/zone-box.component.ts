import { Component, Input } from '@angular/core';

export interface IBox {
  id: number;
  x: number;
  y: number;
}

@Component({
  selector: '[zbox]',
  templateUrl: './zone-box.component.html',
  styleUrls: ['./zone-box.component.less']
})
export class ZoneBoxComponent {
  @Input() zbox: IBox;
  @Input() selected: boolean;

}
