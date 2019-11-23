import { Component, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { IBox, BoxComponent } from './box.component';

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min)) + min;
}

@Component({
  selector: 'app-svg-box',
  templateUrl: './svg-box.component.html',
  styleUrls: ['./svg-box.component.less']
})
export class SvgBoxComponent implements AfterViewInit {
  currentId: number = null;
  boxes: Array<IBox> = [];
  offsetX: number;
  offsetY: number;
  currentBox: BoxComponent = null;

  constructor(
    private cdr: ChangeDetectorRef,
  ) {
    let l: Array<IBox> = [];
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

  ngAfterViewInit() {
    this.cdr.detach();
  }

  mouseDown(event) {
    const id = Number(event.target.getAttribute('dataId'));
    // const box = this.boxes[id];
    const boxComponent = <BoxComponent>event.target['BoxComponent'];
    const box = boxComponent.box;
    this.offsetX = box.x - event.clientX;
    this.offsetY = box.y - event.clientY;
    this.currentId = id;
    this.currentBox = boxComponent;
    boxComponent.selected = true;
    boxComponent.update();
  }

  mouseMove(event: MouseEvent) {
    event.preventDefault();
    // if (this.currentId !== null) {
    //   this.updateBoxById(this.currentId, event.clientX + this.offsetX, event.clientY + this.offsetY);
    // }
    if (this.currentBox !== null) {
      this.updateBox(this.currentBox, event.clientX + this.offsetX, event.clientY + this.offsetY);
    }
  }

  mouseUp(event: MouseEvent) {
    this.currentId = null;
    const boxComponent = this.currentBox;
    this.currentBox = null;
    boxComponent.selected = false;
    boxComponent.update();
    this.offsetX = 0;
    this.offsetY = 0;
  }

  updateBoxById(id: number, x: number, y: number) {
    this.boxes[id] = { id, x, y };
  }

  updateBox(boxComponent: BoxComponent, x: number, y: number) {
    boxComponent.box.x = x;
    boxComponent.box.y = y;
    boxComponent.update();
  }

}
