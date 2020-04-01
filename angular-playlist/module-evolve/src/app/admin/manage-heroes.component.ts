import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-manage-heroes',
  template: `
    <p>
      manage your heroes here!
    </p>
  `,
  styles: []
})
export class ManageHeroesComponent implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
