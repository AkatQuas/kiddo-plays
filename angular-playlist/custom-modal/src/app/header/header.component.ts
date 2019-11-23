import { Component, OnInit } from '@angular/core';
import { ModalService } from '../modal-service.service';
import { LoginComponent } from '../login/login.component';

export interface IStudent {
  name: string;
  age: number;
}

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.less']
})
export class HeaderComponent implements OnInit {
  student: IStudent = {
    name: 'Eric',
    age: 10,
  }

  constructor(
    private modalService: ModalService,
  ) { }

  ngOnInit() {
  }

  initLoginModal() {
    const inputs = {
      isMobile: false,
    };
    this.modalService.init(LoginComponent, inputs, {
      change: (v) => {
        console.log('outputs ', v);
      }
    });
  }

  changeStudentAge() {
    this.student.age = Math.floor(Math.random() * 100);
  }

}
