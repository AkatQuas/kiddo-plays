# Schematics in Angular

[Documents in angular.io](https://angular.io/guide/schematics) provide some concepts with some basic examples.

It's worthy to go through [The Complete Guide to Custom Angular Schematics](https://morioh.com/p/e2e00c50cd7e) and [高效 Coding 術：Angular Schematics 實戰三十天](https://ithelp.ithome.com.tw/users/20090728/ironman/2149).

Better to read the code in [@schematics/angular](https://github.com/angular/angular-cli/tree/master/packages/schematics/angular) if you have more time.

More source code to explore:

- [AngularFire Schematic](https://github.com/blove/angular-fire-schematics)
- [Material Schematic](https://github.com/angular/components/tree/main/src/material/schematics)

### schema.d.ts

Use [dtsgenerate](https://github.com/SitePen/dts-generator) to build `schema.d.ts` from `schema.json`.

```bash
# example
npx dtsgen src/hello-world-ng/schema.json -o src/hello-world-ng/schema.d.ts
```

### Unit Testing

`npm run test` will run the unit tests, using Jasmine as a runner and test framework.

### Real-world Testing

To test locally, install `@angular-devkit/schematics-cli` globally and use the `schematics` command line tool. That tool acts the same as the `generate` command of the Angular CLI, but also has a debug mode.

Check the documentation with

```bash
$ schematics --help

# 1. Create a new NPM package that contains a blank schematic.

$ schematics blank <name>

# 2. Walk through example that demonstrates how to build a schematic.

$ schematics schematic --name <name>
```
