import { Component, OnInit, NgZone } from '@angular/core';

@Component({
  selector: 'app-progress',
  templateUrl: './progress.component.html',
  styleUrls: ['./progress.component.less']
})
export class ProgressComponent implements OnInit {
  progress: number = 0;

  constructor(
    private zone: NgZone,
  ) { }

  ngOnInit() {
  }

  processWithinAngularZone() {
    this.progress = 0;
    this.increaseProgress(() => console.log('Within Done!'));
  }

  processOutsideAngularZone() {
    this.progress = 0;
    this.zone.runOutsideAngular(() => {
      this.increaseProgress(() => {
        this.zone.run(() => {
          console.log('Outside Done!');
        });
      });
    });
  }

  increaseProgress(done: () => void) {
    this.progress += 1;
    console.log('Current progress: %d', this.progress);
    if (this.progress < 100) {
      window.setTimeout(() => {
        this.increaseProgress(done);
      }, 10);
    } else {
      done();
    }
  }

}
