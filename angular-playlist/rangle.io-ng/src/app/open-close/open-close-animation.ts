import {
  animate,
  AnimationTriggerMetadata,
  keyframes,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';

/**
 * Animations used by OpenClose.
 */
export const openCloseAnimation: {
  readonly state: AnimationTriggerMetadata;
} = {
  state: trigger('openClose', [
    state(
      'open',
      style({
        height: '100px',
        opacity: 1,
        backgroundColor: 'yellow',
        transform: 'scale(2, 1)',
      })
    ),
    state(
      'in-action',
      style({
        height: '100px',
        opacity: 1,
        backgroundColor: 'orange',
        transform: 'scale(1, 1)',
      })
    ),
    state(
      'closed',
      style({
        height: '100px',
        opacity: 0.5,
        backgroundColor: 'green',
        transform: 'scale(1, 1)',
      })
    ),
    transition(
      'open => closed',
      animate(
        '2s cubic-bezier(0, 0, 0.2, 1)',
        keyframes([
          style({
            backgroundColor: 'yellow',
            transform: 'scale(2,1)',
            offset: 0,
          }),
          style({
            backgroundColor: 'red',
            opacity: 1,
            transform: 'scale(1.5, 1)',
            offset: 0.8,
          }),
          style({
            backgroundColor: 'green',
            opacity: 0.5,
            transform: 'scale(1, 1)',
            offset: 1.0,
          }),
        ])
      )
    ),
    transition('open => *', animate('200ms cubic-bezier(0, 0, 0.2, 1)')),
    transition('* => closed', animate('600ms cubic-bezier(0, 0, 0.2, 1)')),
    transition('* => *', [animate('0.5s')]),
  ]),
};
