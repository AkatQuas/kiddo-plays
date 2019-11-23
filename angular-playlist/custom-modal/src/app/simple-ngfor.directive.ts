import { Directive, DoCheck, ViewContainerRef, TemplateRef, Input, EmbeddedViewRef } from '@angular/core';

export class SimpleNgForRow {
  constructor(
    public $implicit: any,
    public index: number,
  ) { }

  get even(): boolean {
    return this.index % 2 === 0;
  }

  get odd(): boolean {
    return this.index % 2 === 1;
  }
}

@Directive({
  selector: '[simpleNgFor][simpleNgForOf]'
})
export class SimpleNgFor implements DoCheck {
  @Input() simpleNgForOf: any[];

  constructor(
    private _viewContainer: ViewContainerRef,
    private _template: TemplateRef<SimpleNgForRow>
  ) { }

  @Input()
  set ngForTemplate(value: TemplateRef<SimpleNgForRow>) {
    if (value) {
      this._template = value;
    }
  }

  ngDoCheck() {
    const oldLen = this._viewContainer.length;
    const newLen = this.simpleNgForOf.length;
    const minLen = Math.min(oldLen, newLen);

    // update existing rows
    for (let i = 0; i < minLen; i += 1) {
      const row = this.simpleNgForOf[i];
      const viewRef = <EmbeddedViewRef<SimpleNgForRow>>this._viewContainer.get(i);
      viewRef.context.$implicit = row;
    }

    // add missing rows
    for (let i = oldLen; i < newLen; i += 1) {
      const row = this.simpleNgForOf[i];
      this._viewContainer.createEmbeddedView(this._template, new SimpleNgForRow(row, i));
    }

    // remove superfluous rows
    for (let i = oldLen - 1; i >= newLen; i -= 1) {
      this._viewContainer.remove(i);
    }
  }
}
