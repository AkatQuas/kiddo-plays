import {
  AfterContentInit,
  Component,
  ElementRef,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { RandomService } from '../ray/random.service';

@Component({
  selector: 'app-hello',
  templateUrl: './hello.component.html',
  styleUrls: ['./hello.component.less'],
  encapsulation: ViewEncapsulation.Emulated,
})
export class HelloComponent implements AfterContentInit {
  @Input() name: string;
  color = 'black';
  random: string;

  constructor(
    private elementRef: ElementRef,
    private randomSrv: RandomService
  ) {}

  ngAfterContentInit(): void {
    console.log(`xedlog ref ->`, this.elementRef.nativeElement);
  }

  private getRandomColor(): string {
    const letters = '0123456789ABCDEF'.split('');
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  randomizeColor(): void {
    this.color = this.getRandomColor();
    this.random = this.randomSrv.getRandom();
  }
}
