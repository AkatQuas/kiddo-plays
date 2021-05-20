import { Pipe, PipeTransform } from '@angular/core';

const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
const FILE_SIZE_UNITS_LONG = [
  'Bytes',
  'Kilobytes',
  'Megabytes',
  'Gigabytes',
  'Terabytes',
  'Pettabytes',
  'Exabytes',
  'Zettabytes',
  'Yottabytes',
];

@Pipe({
  name: 'formatFileSize',
})
export class FormatFileSizePipe implements PipeTransform {
  transform(sizeInBytes: number, longForm: boolean = false): string {
    const units = longForm ? FILE_SIZE_UNITS_LONG : FILE_SIZE_UNITS;

    // let power = Math.round(Math.log(sizeInBytes) / Math.log(1024));
    // power = Math.min(power, units.length - 1);

    // using const number, quicker
    let power = Math.round(Math.log(sizeInBytes) / 6.931471805599453);
    power = Math.min(power, 8);

    const size = sizeInBytes / Math.pow(1024, power); // size in new units
    const formattedSize = Math.round(size * 100) / 100; // keep up to 2 decimals
    const unit = units[power];

    return `${formattedSize} ${unit}`;
  }
}
