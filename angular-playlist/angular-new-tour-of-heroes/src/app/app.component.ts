import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less']
})
export class AppComponent {
  constructor(private route: ActivatedRoute) {
  }
  ngOnInit() {

  }
  title = 'New Tour of Heroes';
}
