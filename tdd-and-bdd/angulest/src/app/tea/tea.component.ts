import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-tea',
  templateUrl: './tea.component.html',
  styleUrls: ['./tea.component.less']
})
export class TeaComponent implements OnInit {
  tea: string = 'ctctea';

  constructor() { }

  ngOnInit() {
  }

  setTea(): string {
    const a =  Math.floor(Math.random() * 10000).toString(16);
    this.tea = a;
    return a;
  }

}
