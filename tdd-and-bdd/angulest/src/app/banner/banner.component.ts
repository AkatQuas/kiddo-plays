import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-banner',
  template: `
    <h1>{{title}}</h1>
    <p>
      banner works!
    </p>
  `,
  styles: [`h1 { color: green; font-size: 350%; }`]
})
export class BannerComponent implements OnInit {
  title: string = 'Test of Heroes';

  constructor() { }

  ngOnInit() {
  }

}
