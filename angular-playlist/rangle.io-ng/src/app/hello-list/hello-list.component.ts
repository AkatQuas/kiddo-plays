import {
  AfterContentInit,
  Component,
  ContentChild,
  ContentChildren,
  QueryList,
} from '@angular/core';
import { HelloComponent } from './hello.component';

@Component({
  selector: 'app-hello-list',
  templateUrl: './hello-list.component.html',
  styleUrls: ['./hello-list.component.less'],
})
export class HelloListComponent implements AfterContentInit {
  @ContentChildren(HelloComponent) helloChildren: QueryList<HelloComponent>;
  @ContentChild('last') lastChild: HelloComponent;

  constructor() {}
  ngAfterContentInit(): void {
    // Content children now set
    this.onClickAll();
  }

  onClickAll(): void {
    this.helloChildren.forEach((child) => child.randomizeColor());
  }

  onClickLast(): void {
    this.lastChild.randomizeColor();
  }
}
