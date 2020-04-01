import { Component, NgZone } from '@angular/core';
import { IBox } from './zone-box.component';

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min)) + min;
}

@Component({
  selector: 'app-zone-svg',
  templateUrl: './zone-svg.component.html',
  styleUrls: ['./zone-svg.component.less']
})
export class ZoneSvgComponent {
  currentId: number = null;
  boxes: IBox[] = [];
  offsetX: number;
  offsetY: number;
  element;

  constructor(
    private zone: NgZone,
  ) {
    const l = [];
    for (let i = 0; i < 10000; i++) {
      const id = i;
      const x = getRandomInt(0, 500);
      const y = getRandomInt(0, 500);
      const box = {
        id,
        x,
        y
      };
      l.push(box);
    }
    this.boxes = l;
  }

  bindMouse = (ev) => {
    this.mouseMove(ev);
  }

  mouseDown(event) {
    const id = Number(event.target.getAttribute('dataId'));
    const box = this.boxes[id];
    this.offsetX = box.x - event.clientX;
    this.offsetY = box.y - event.clientY;
    this.currentId = id;
    this.element = event.target;
    this.zone.runOutsideAngular(() => {
      window.document.addEventListener('mousemove', this.bindMouse);
    });
  }

  mouseMove(event: MouseEvent) {
    event.preventDefault();
    this.element.setAttribute('x', event.clientX + this.offsetX + 'px');
    this.element.setAttribute('y', event.clientY + this.offsetY + 'px');
    // Another options is to change styles using transformations
    // this.element.style = `transform: translate3d(${event.clientX - this.offsetX}px, ${event.clientY - this.offsetY}px, 0)`;
  }
  mouseUp(event) {
    this.zone.run(() => {
      this.updateBox(this.currentId, event.clientX + this.offsetX, event.clientY + this.offsetY);
      this.currentId = null;
    })
    window.document.removeEventListener('mousemove', this.bindMouse);
  }

  updateBox(id: number, x: number, y: number) {
    const box = this.boxes[id];
    box.x = x;
    box.y = y;
  }


}
