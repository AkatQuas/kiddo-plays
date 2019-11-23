import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-wrapper',
  template: `
      <p>small wrapper for the <i>directives / databinding / lifecycle</i></p>
      <app-directives></app-directives>
      <app-databinding></app-databinding>
      <app-lifecycle [lifehere]="'23423lkfjaw'">
          <p #cp>content child</p>
      </app-lifecycle>
  `,
  styles: []
})
export class WrapperComponent implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
