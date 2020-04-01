import {Component} from '@angular/core';

@Component({
    selector: 'app-property-binding',
    template: `
        {{result}}
    `,
    styles: [],
    inputs: ['result']
})
export class PropertyBindingComponent {
    result: number = 0;

    // @Input() result: number = 0; // the same way to write input props

    constructor() {
    }


}
