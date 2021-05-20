# Overview

Google your questions proactively.

The three projects, [first-app](./first-app), [module-evolve](./module-evolve) and [recipe-app](./recipe-app), are built on `Angular 4`.

[angular-new-tutorial-of-heroes](./angular-new-tour-of-heroes) built on `Angular 7`.

`Angular` is evolving rapidly, you'd better catch up!

[custom-modal](./custom-modal) is about something deep in Angular, `NgZone`, ` ComponentFactoryResolver`.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

**Table of Contents**

- [Concepts recap](#concepts-recap)
- [Angular CLI](#angular-cli)
- [In APP development](#in-app-development)
- [Build](#build)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# Concepts recap

An _i18n localized_ demo project with more [details(./rangle.io-ng).

# Angular CLI

The official document is [here](https://github.com/angular/angular-cli/wiki), so you can find the all commands available.

`ng` command will use the `angular-cli.json` file (located in the project root) to generate or serve.

`ng new my-project --style=scss` make it posiible to use `scss` in the project. You can choose any other style language as you wish.

It is recommended to config the `.angular-cli.json` file in advance. A personal practice is [here](./angular-cli.json). In Angular 6 or later, the `angular-cli.json` schema has changed a lot, so this file is kind of out-of-date. You'd better configure properly.

config in `package.json`

```bash
# production build
npm run build ---> ng build --prod

# development
npm run start ---> ng serve --aot

# lint fix
npm run lint ---> ng lint --fix
```

# In APP development

Search in the [API document](https://angular.io/api/) to find the interface of the APIs if you need it.

- `*ngIF` can work like `ternary statement`, [examples](https://angular.io/api/common/NgIf)

- the result in `*ngIf` condition statement can be stored as a local variable, the document has the [examples](https://angular.io/api/common/NgIf).

- `*ngFor` allows customized template and the iterator syntax is a little bit different. the [doc](https://angular.io/api/core/TrackByFunction) of `trackBy` function. The whole [document](https://angular.io/api/common/NgForOf)

- `one-way data binding` has a different syntax like `bind-${attr}`, `(event)` works as well as `on-${event}`, check the [document](https://angular.io/guide/template-syntax#binding-syntax-an-overview)

- the order of `imports` in `app.module.ts` matters, especially when dealing with the route navigation!

- router guard, `canActivate`, `canDeactivate`, `canLoad` in lazy-loading (or asynchronousls routing)

- when observe on params, query ... on some `Observable`, try to `unsubsrcibe` them on Destroy hook.

- `handleError` function in `http/Observable`

- `debounceTime(500).distinctUntilChanged().` when listening to input and search

- `async` pipe helps to Unwraps a value from an asynchronous primitive. [doc](https://angular.io/api/common/AsyncPipe)

- mock data with `rxjs`. observable, operators

- `--aot` helps uglify the code.

# Build

- `ng build --base-href` helps you to define the `js` refered when the `index.html` is not in the website root folder. And the `image assets` should be written in relative mode like `assets/a.img` rather than beginning with `/` which is an absolute path.

- `ng build --prod` to build production with `--aot` in default.
