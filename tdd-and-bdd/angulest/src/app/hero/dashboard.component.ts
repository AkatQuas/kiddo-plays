import { Component, OnInit, EventEmitter, Input, Output } from '@angular/core';
import { IHero } from './hero.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.less']
})
export class DashboardComponent implements OnInit {
  @Input() hero: IHero = null;
  @Output() selected = new EventEmitter<IHero>();

  constructor() { }

  ngOnInit() {
  }

  click(): void {
    this.selected.emit(this.hero);
  }

}
