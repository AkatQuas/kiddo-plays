import { Component, OnInit } from '@angular/core';
import { SelectivePreloadingStrategy } from '../selective-preloading-strategy';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-admin-dashboard',
  template: `
    <p> Admin-Dashboard ! </p>
  `,
  styles: []
})
export class AdminDashboardComponent implements OnInit {
  modules: string[];
  constructor(
    private route: ActivatedRoute,
    private preloadStrategy: SelectivePreloadingStrategy
  ) {
    this.modules = preloadStrategy.preloadedModules;
  }

  ngOnInit() {
  }

}
