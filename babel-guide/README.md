# Babel Guide

Babel is a JavaScript compiler.

You can play it interactively at the [playground](https://babeljs.io/repl).

Play with the AST nodes at [AST Explorer](https://astexplorer.net/) or [Babel AST Explorer](https://lihautan.com/babel-ast-explorer).

Have fun playing with Babel.

## Use Babel's api

```bash
npm install

# hand-made plugins
make example1-hand

# hand-made plugins
make example2-hand
```

## What is the **preset**?

Sharable set of Babel plugins and/or config [`options`](https://babeljs.io/docs/en/options).

Check out the [@babel/preset-react](https://github.com/babel/babel/blob/1e3ef0568558eeabb0c95e02102e40b30169df9b/packages/babel-preset-react), this package exports an object with [`plugins`](https://github.com/babel/babel/blob/1e3ef0568558eeabb0c95e02102e40b30169df9b/packages/babel-preset-react/src/index.js#L22).

```javascript
// my-quick-preset
import { declare } from '@babel/helper-plugin-utils';

export default declare((api, opts) => {
  // return a babel config object
  return {
    plugins: [
      // ... plugin configure object
    ],
  };
});
```

In usage,

```json
{
  "presets": [
    "@babel/preset-env",
    ["my-quick-preset", { "quick": true, "time": 12 }]
  ]
}
```

The execution order is `my-quick-preset`, then `@babel/preset-env`.

`{ "quick": true, "time": 12 }` will be the option value in the function as the second parameter `opts`.

```bash
# install dependencies
npm install

# check out the output
make example1
```

## What is the plugin?

Babel's code transformations are enabled by applying plugins (or presets) to the configuration file.

1. Plugins run before presets!
1. Plugins ordering is first to last.

```bash
# install dependencies
npm install

# check out the output
make example2
```

### How to write a **plugin**?

[The handbook](https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md)

> Babel is a compiler, or a transpiler.

Babel need an AST tree to work. Each AST nodes has the basic interface.

```typescript
interface Node {
  type: string;
}
```

Babale has three primary stages: **parse**, **transform**, **generate**.

Traverse the AST tree first, then we can transform the AST. When traversing, we are actually **visiting** them.

```typescript
import * as t from '@babel/types';

const innerVisitor = {
  Identifier(path) {
    console.log(this.someState); // should be 'anything'
    // ...
  },
  BinaryExpression(path) {
    // ...
  },
};
const BaseVisitor = {
  enter(path) {
    const { node } = path;
    if (node !== null && node.type === 'Identifier' && node.name === 'n') {
      node.name = 'nn';
    }
    // equivalent predicate
    if (t.isIdentifier(node, { name: 'n' })) {
      node.name = 'nn';
    }
  },
  BinaryExpression(path) {
    if (t.isIdentifier(path.get('left'))) {
      // ...
    }
    if (path.get('left').isIdentifier({ name: 'n' })) {
      // ...
    }
    path.replaceWith(
      /* a AST node to replace */
      t.binaryExpression(/*  */)
    );
    path.replaceWithSourceString(`function a() {/* */}`);
  },
  ClassMethod(path) {
    path.get('body').unshiftContainer('body' /* some AST node */);
    path.get('body').pushContainer('body' /* some AST node */);

    /* nested travering */
    path.traverse(innerVisitor, { someState: 'anything' });
  },
  FunctionDeclaration: {
    enter(path) {
      /*  */
      path.insertBefore(/* some AST node */);
      path.insertAfter(/* some AST node */);

      path.scope.hasBinding('n');

      path.scope.hasOwnBinding('n');
    },
  },
  Identifier(path) {
    path.remove();
    path.parentPath.replaceWith(/* some AST node */);
    path.parentPath.remove();
    /*  */
  },
  'ExportNameDecalration|Flow'(path) {
    throw path.buildCodeFrameError('Error');
    /*  */
  },
  'BlockStatement|ReturnStatement': {
    enter(path) {
      /*  */
    },
  },
};
```

> In a sense, paths are a reactive representation of a node's position in the tree and all sorts of information about the node.

### Test a plugin

We can test a plugin with the help of `jest` and [`babel-plugin-tester`](https://github.com/babel-utils/babel-plugin-tester).

Here is some example code at [`test/plugin.test.js`](./test/plugin.test.js).

> `@babel/helper-plugin-test-runner` is kind of unavailable outside the `@babel/babel` project.

**Templates**

[`@babel/template`](https://babeljs.io/docs/en/babel-template) allows us to write strings of code with placeholders that we can use instead of manually building up a massive AST, also known as _quasiquotes_.

## Resources

[AST explorer for almost every language](https://astexplorer.net/)

[Babel AST explorer](https://lihautan.com/babel-ast-explorer/#?eyJiYWJlbFNldHRpbmdzIjp7InZlcnNpb24iOiI3LjYuMCJ9LCJ0cmVlU2V0dGluZ3MiOnsiaGlkZUVtcHR5IjpmYWxzZSwiaGlkZUxvY2F0aW9uIjp0cnVlLCJoaWRlVHlwZSI6ZmFsc2UsImhpZGVDb21tZW50cyI6ZmFsc2V9LCJjb2RlIjoiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBudW1iZXIgPSAxIn0=)

[Babel handbook](https://github.com/jamiebuilds/babel-handbook/tree/master/translations/en)
