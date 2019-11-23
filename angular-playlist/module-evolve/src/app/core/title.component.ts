import { Component, OnInit } from '@angular/core';
import { UserService } from './user.service';

@Component({
    selector: 'app-title',
    templateUrl: './title.component.html',
    styles: [`
        p {
            background-color: red;
        }
    `]
})
export class TitleComponent implements OnInit {
    title = 'Title Component';
    user = '';

    constructor ( userService: UserService ) {
        this.user = userService.userName;
    }

    ngOnInit () {
    }

}
