import { Component, Input, ChangeDetectionStrategy, AfterViewInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';

export interface IBox {
  id: number;
  x: number;
  y: number;
}

@Component({
  selector: '[box]',
  templateUrl: './box.component.html',
  styleUrls: ['./box.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoxComponent implements AfterViewInit {
  @Input() box: IBox;
  @Input() selected: boolean;

  @ViewChild('rect')
  set rect(value: ElementRef) {
    if (value) {
      value.nativeElement['BoxComponent'] = this;
    }
  }

  constructor(
    private cdr: ChangeDetectorRef,
  ) { }

  ngAfterViewInit() {
    this.cdr.detach();
  }

  update() {
    this.cdr.detectChanges();
  }
}
