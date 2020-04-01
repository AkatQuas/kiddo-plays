import { Directive, OnChanges, Input, ElementRef } from '@angular/core';

@Directive({
  selector: '[highlight]'
})
export class HighlightDirective implements OnChanges {
  defaultColor = 'rgb(211, 211, 211)';

  @Input('highlight') bgColor: string;

  constructor(
    private el: ElementRef
  ) {
    el.nativeElement.style.customProperty = true;
  }

  ngOnChanges() {
    this.el.nativeElement.style.backgroundColor = this.bgColor || this.defaultColor;
  }

}
