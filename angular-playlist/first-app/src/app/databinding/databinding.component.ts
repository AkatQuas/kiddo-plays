import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-databinding',
  templateUrl: './databinding.component.html',
  styleUrls: ['./databinding.component.css'],
})
export class DatabindingComponent implements OnInit {
    stringInterpolation = 'string interpolation all?';
    numberInterpolation = 2 ;
    delete = false;
  constructor() { }

  ngOnInit() {
  }

  componentFunc() {
      // return Math.random() > 0.5;
      return true
  }
  UpClick(value:string) {
      alert(value)
  }

}
