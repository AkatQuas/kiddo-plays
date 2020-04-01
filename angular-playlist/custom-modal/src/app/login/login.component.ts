import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.less']
})
export class LoginComponent implements OnInit {
  @Input() isMobile: boolean = false;
  @Output() mchange: EventEmitter<boolean> = new EventEmitter<boolean>();
  constructor() { }

  ngOnInit() {
  }


  mochange() {
    console.log(this.isMobile);
    this.mchange.emit(this.isMobile);
  }

}
