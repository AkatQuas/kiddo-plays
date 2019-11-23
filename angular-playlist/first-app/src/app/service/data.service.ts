import {EventEmitter, Injectable} from '@angular/core';
import {LogService} from './log.service';
//
@Injectable()
export class DataService {
    pushDataEmitter = new EventEmitter<string>();
    private data: any[] = [];

    constructor(private logService: LogService) {
    }

    addData(input: any) {
        this.data.push(input);
        this.logService.writeToLog('Saved item: ' + input);
    }

    getData() {
        return this.data;
    }

    pushData(value: string) {
        this.pushDataEmitter.emit(value);
    }

}
