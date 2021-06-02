import { AnimationEvent } from '@angular/animations';
import { Component } from '@angular/core';
import { openCloseAnimation } from './open-close-animation';

const openCloseStates: openCloseState[] = ['open', 'closed', 'in-action'];
type openCloseState = 'open' | 'closed' | 'in-action';
const nextState = (previous: openCloseState) => {
  while (true) {
    const next = openCloseStates[~~(Math.random() * openCloseStates.length)];

    if (next !== previous) {
      return next;
    }
  }
};

@Component({
  selector: 'app-open-close',
  templateUrl: './open-close.component.html',
  styleUrls: ['./open-close.component.less'],
  animations: [openCloseAnimation.state],
})
export class OpenCloseComponent {
  openState: openCloseState = 'open';
  toggle(): void {
    this.openState = nextState(this.openState);
  }
  _animationStart(event: AnimationEvent) {
    const fromState = event.fromState as openCloseState;

    console.log(
      'openClose animation start from State -> ',
      fromState,
      event.element
    );
  }

  _animationDone(event: AnimationEvent): void {
    const toState = event.toState as openCloseState;
    console.log('openClose animation end, toState -> ', toState);
  }
}
