import { Component, OnInit } from '@angular/core';
import { Page } from '../../models/page';
import { PageService } from '../../services/page.services';
import { RouterExtensions } from 'nativescript-angular/router';
import { NavigationOptions } from 'nativescript-angular/router/ns-location-strategy';
import { ItemEventData } from 'ui/list-view';

@Component({
  // selector: 'list',
  moduleId: module.id,
  providers: [PageService],
  templateUrl: './list.html',
  styleUrls: ['./list.css']
})
export class ListComponent implements OnInit {
  pages: Array<Page>;

  constructor(
    private _pageService: PageService,
    private _router: RouterExtensions) {

  }
  ngOnInit(): void {
    this.pages = this._pageService.getPages();
  }
  
  onItemTap(args: ItemEventData): void {
      this._router.navigate(['detail', args.index])
  }

  onAddTap(): void {
    const options: NavigationOptions = {
      // clearHistory: true
    }
    this._router.navigate(['detail', this.pages.length], options)
  }
}