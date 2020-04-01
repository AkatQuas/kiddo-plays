import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
    name: 'double'
})
export class DoublePipe implements PipeTransform {

    transform(value: any, args?: any): any {
        console.log(typeof(value))
        return 'wrong input' + value;
    }

}
