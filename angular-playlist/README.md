# Overview

Google your questions proactively.

The three projects, [first-app](./first-app), [module-evolve](./module-evolve) and [recipe-app](./recipe-app), are built on `Angular 4`.

[angular-new-tutorial-of-heroes](./angular-new-tour-of-heroes) built on `Angular 7`.

`Angular` is evolving rapidly, you'd better catch up!

[custom-modal](./custom-modal) is about something deep in Angular, `NgZone`, ` ComponentFactoryResolver`.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Concepts recap](#concepts-recap)
- [Angular CLI](#angular-cli)
- [In APP development](#in-app-development)
- [Build](#build)
- [Angular Components](#angular-components)
  - [Developer Conduction](#developer-conduction)
  - [Building tools](#building-tools)
    - [Bazel](#bazel)
    - [Angular/dev-infra-private](#angulardev-infra-private)
  - [Package.json](#packagejson)
    - [NPM scripts](#npm-scripts)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# Concepts recap

An _i18n localized_ demo project with more [details](./rangle.io-ng).

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

---
# Angular Components

[Repository](https://github.com/angular/components)

## Developer Conduction

[Dev_environment](https://github.com/angular/components/blob/master/DEV_ENVIRONMENT.md)

## Building tools

### Bazel

[@bazel/bazelisk](https://github.com/bazelbuild/bazelisk): A user-friendly launcher for Bazel.

[Bazel watcher](https://github.com/bazelbuild/bazel-watcher): A source file watcher for Bazel projects.

[Linting and formatting tools for Bazel](https://github.com/bazelbuild/buildtools).

### Angular/dev-infra-private

[ng-dev](https://github.com/angular/dev-infra-private-builds/tree/master)

## Package.json

### NPM scripts

**development**

Start development server. The project source is under `src/dev-app`.

```jsonc
// in root package.json
"scripts": {
  // run bazel in watch mode
  // sart devserver
  "dev-app": "ibazel run //src/dev-app:devserver",
}
```

**test**

Run tests.

```jsonc
"scripts": {
  /**
  * Script that simplifies the workflow of running unit tests for a component
  * using Bazel.
  *
  * Supported command line flags:
  *
  *   --local    | If specified, no browser will be launched.
  *   --firefox  | Instead of Chrome being used for tests, Firefox will be used.
  *   --no-watch | Watch mode is enabled by default. This flag opts-out to standard Bazel.
  */
  "test": "node ./scripts/run-component-tests.js",
  "test-local": "yarn -s test --local",
  "test-firefox": "yarn -s test --firefox",


  "e2e": "bazel test //src/... --build_tag_filters=e2e --test_tag_filters=e2e --build_tests_only",
  "integration-tests": "bazel test --test_tag_filters=-view-engine-only,-linker-integration-test --build_tests_only -- //integration/... -//integration/size-test/...",
  "integration-tests:view-engine": "bazel test --test_tag_filters=view-engine-only --build_tests_only -- //integration/... -//integration/size-test/...",
  "integration-tests:partial-ivy": "bazel test --//tools:partial_compilation=True --test_tag_filters=partial-compilation-integration --build_tests_only -- //integration/... //src/...",
  "integration-tests:size-test": "bazel test //integration/size-test/...",
}
```

**build**

```jsonc
"scripts": {
  /**
   * incremental builds of the packages, output dist/release
   * Script that builds the release output of all packages which have the "release-package
   * bazel tag set. The script builds all those packages and copies the release output to the
   * distribution folder within the project.
   */
  "build": "node ./scripts/build-packages-dist.js",

  /**
   * incremental builds of components-examples, output dist/docs-content-pkg
   * Script that builds the docs content NPM package and moves it into an conveniently
   * accessible distribution directory (the project `dist/` directory).
   */
  "build-docs-content": "node ./scripts/build-docs-content.js",

  /**
   * Script that builds the dev-app as a static web package that will be
   * deployed to the currently configured Firebase project.
   */
  "deploy-dev-app": "node ./scripts/deploy-dev-app.js"
}
```

**other**

```jsonc
"scripts": {
  /**
   * lint
   */
  "lint": "yarn -s tslint && yarn -s stylelint && yarn -s ownerslint && yarn -s ng-dev format changed --check",
  "tslint": "tslint -c tslint.json --project ./tsconfig.json",
  "stylelint": "stylelint \"src/**/*.+(css|scss)\" --config .stylelintrc.json --syntax scss",

  // display breaking changes in comments
  "breaking-changes": "ts-node --project scripts/tsconfig.json scripts/breaking-changes.ts",

  /**
   * You can register gulp tasks dynamically,
   * checkout "tools/gulp/gulpfile.ts" and "tools/package-tools/gulp/build-tasks-gulp.ts"
   * task(name, [dependencies], callback)
   */
  "gulp": "gulp",

  /**
   * stage a new release
   */
  "stage-release": "ts-node --project tools/release/tsconfig.json tools/release/stage-release.ts",

  /**
   * create a new release
   */
  "publish-release": "ts-node --project tools/release/tsconfig.json tools/release/publish-release.ts",

  /**
  * Script that detects and validates entry-points. The script walks through all
  * source files in the code base and ensures that determined entry-points are
  * configured. The list of configured entry-points in Starlark is passed to the
  * script through a manifest file (generated by Bazel)
  */
  "check-entry-point-setup": "node ./scripts/check-entry-point-setup.js",

  /**
  * Checks the release output by running the release-output validations for each release package.
  * version, LICENSE README.md files
  */
  "check-release-output": "ts-node --project tools/release/tsconfig.json tools/release/check-release-output.ts",
  "check-rollup-globals": "ts-node --project scripts/tsconfig.json scripts/check-rollup-globals.ts",

  /**
   * update change log
   */
  "changelog": "ts-node --project tools/release/tsconfig.json tools/release/changelog.ts",
  /**
   * format files, prettier
   */
  "format": "yarn ng-dev format changed",
  "cherry-pick-patch": "ts-node --project tools/cherry-pick-patch/tsconfig.json tools/cherry-pick-patch/cherry-pick-patch.ts",

  /**
  * Script that lints the CODEOWNERS file and makes sure that all files have an owner.
  */
  "ownerslint": "ts-node --project scripts/tsconfig.json scripts/ownerslint.ts",

  "resync-caretaker-app": "ts-node --project scripts/tsconfig.json scripts/caretaking/resync-caretaker-app-prs.ts",
  "ts-circular-deps:check": "yarn -s ng-dev ts-circular-deps check --config ./src/circular-deps-test.conf.js",
  "ts-circular-deps:approve": "yarn -s ng-dev ts-circular-deps approve --config ./src/circular-deps-test.conf.js",
  "merge": "ng-dev pr merge",
  "approve-api": "node ./scripts/approve-api-golden.js",
  "approve-size-tests": "node ./scripts/approve-size-golden.js",
  "check-tools": "yarn tsc --project tools/tsconfig-ci.json",

  /**
   * Goes through all the unit tests and flags the ones that don't exist in the MDC components.
   */
  "check-mdc-tests": "ts-node --project scripts/tsconfig.json scripts/check-mdc-tests.ts",

  /**
   * Script which ensures that a particular MDC package exports all of the same symbols as its
   * non-MDC counterparts. Only looks at symbol names, not their signatures. Exceptions
   * can be configured through the `check-mdc-exports-config.ts` file.
   */
  "check-mdc-exports": "ts-node --project scripts/tsconfig.json scripts/check-mdc-exports.ts",

  "prepare": "husky install"
}
```

Instance `tools/release/git/git-client.ts` of a wrapper that can execute GitCommands.
