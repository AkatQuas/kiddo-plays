import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-protected',
  template: `
    <p>
      protected Works!
    </p>
  `,
  styles: []
})
export class ProtectedComponent implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
