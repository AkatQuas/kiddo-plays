# CustomModal

[Tutorial document](https://itnext.io/angular-create-your-own-modal-boxes-20bb663084a1).

And

1. on Lazy Input with `ReactiveFormsModule` and `formControl`, [example](./src/app/lazy-input/lazy-input.component.ts#L15).

1. on how change detection works in Angular, [example](./src/app/counter/counter.component.ts#L23).

1. `Zone` (`NgZone`) plays an important role during change detection. `Zone` provides a context for the running functions. [example 1](./src/app/progress/progress.component.ts#L23), [example 2](./src/app/zone-svg/zone-svg.component.ts#L49), [contrary to zone example, which is very slow and UI-slutter](./src/app/svg-box/svg-box.component.ts#L56).



This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 7.3.9.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via [Protractor](http://www.protractortest.org/).

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).
