import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'titleCase'
})
export class TitleCasePipe implements PipeTransform {

  transform(value: string): string {
    return value.length === 0  ? '':
    value.replace(/\w\S*/g, text => text[0].toUpperCase() + text.substr(1).toLowerCase());
  }

}
