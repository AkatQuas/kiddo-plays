import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
    name: 'filter',
    pure: false
})
export class FilterPipe implements PipeTransform {

    transform(value: any, args?: any): any {
        if (value.length === 0) {
            return value;
        }
        return value.filter(v => v.match('^.*' + args[0] + '.*$'))
    }

}
