import { Component, Input } from '@angular/core';

@Component({
  selector: 'hello-<%= dasherize(name) %>',
  template: `<h1>Hello {{ message }} from <%= name %></h1>`,
  styles: [
    `
      h1 {
        font-family: Lato;
      }
    `,
  ],
})
export class Hello<%= classify(name) %>Component {
  @Input() message: string;
}
