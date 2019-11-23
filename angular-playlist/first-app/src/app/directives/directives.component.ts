import {Component, OnInit} from '@angular/core';
import {DataService} from '../service/data.service';

import { LogService} from '../service/log.service';
@Component({
    selector: 'app-directives',
    templateUrl: './directives.component.html',
    styleUrls: ['./directives.component.css'],
    providers: [ DataService]
})

export class DirectivesComponent implements OnInit{
    cond = true;
    items = [1, 2, 3, 4, 5];
    value = 100;

    constructor(private logService: LogService, private dataService: DataService) {}

    onLog(value: string) {
        this.logService.writeToLog(value);
    }

    onStore(value: string) {
        this.dataService.addData(value);
    }
    onGet() {
        // this.items = this.dataService.getData();
        this.items = this.dataService.getData().slice(0);
    }
    onSwitch() {
        this.cond = !this.cond;
    }

    onSend(value) {
        this.dataService.pushData(value);
    }

    ngOnInit() {
        this.dataService.pushDataEmitter.subscribe(
            data => {
                this.value = data;
            }
        );
    }

}
