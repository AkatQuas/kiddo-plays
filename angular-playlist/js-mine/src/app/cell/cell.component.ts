import { Component, OnInit, Input } from '@angular/core';
import { Cell } from '../cell';

@Component({
  selector: 'app-cell',
  templateUrl: './cell.component.html',
  styleUrls: ['./cell.component.less']
})
export class CellComponent implements OnInit {
  @Input() cell: Cell;
  label: string;

  constructor() { }

  ngOnInit() {
    this.label = this.cell.mined ? '💣' : (this.cell.neighbors ? this.cell.neighbors.toString() : '');
  }

}
