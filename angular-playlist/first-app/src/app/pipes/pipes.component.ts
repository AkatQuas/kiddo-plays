import {Component, OnInit} from '@angular/core';

@Component({
    selector: 'app-pipes',
    templateUrl: './pipes.component.html',
    styles: [`
        .pipes {
            margin: 32px;
        }
    `]
})
export class PipesComponent implements OnInit {
    myValue = 'lowercase';
    myDate = new Date(2016, 5, 24);
    values = ['Milk', 'Bread', 'Beans'];

    asyncValue = new Promise((resolve, reject) => {
        setTimeout(_ => {
            resolve('Data is async!')
        }, 1500)
    })
    constructor() {
    }

    ngOnInit() {
    }

    updateValues(item: string) {
        console.log(this.asyncValue)
        const temp = this.values.slice(0);
        this.values = temp;
        this.values.push(item)
    }
}
