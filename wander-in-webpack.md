# Wander in webpack

## Setup the project

```bash
git clone https://github.com/webpack/webpack.git && cd webpack

# maybe switch to some branch/tag

# mannually
npm install -g yarn
yarn
yarn link
yarn link webpack

# automatically
npm run setup
# or
yarn setup
```

At webpack, `yarn` is preferred.

If you already have `yarn` installed, do: `yarn setup`. This will complete all required steps.

If not, do: `npm run setup`, the setup will also install `yarn` for you.

And you are good to go.

## Entry files

The command-line executable file is `bin/webpack.js`, which will invoke the `webpack-cli` command.

The normal script entry file is `lib/index.js`, which groups the main webpack module from `lib/webpack.js` and other plugins, such as `DefinePlugin`, `DllPlugin`, and utilities.

## Webpack in script

### Webpack module

The entry function is the module exported from `lib/webpack.js`.

It has an nested function to create a compiler (one of `lib/Compiler.js` and `lib/MultiCompiler.js`), and check the [watch mode](https://webpack.js.org/configuration/watch/).

During the compiler creating time, the input options are normalized (`getNormalizedWebpackOptions` from `lib/config/normalization.js`), base-defaults-applied (`applyWebpackOptionsBaseDefaults` from `lib/config/defaults.js`), plugin-injected, defaults-applied (`applyWebpackOptionsDefaults` from `lib/config/defaults.js`).

Some hooks of the compiler is called, `hooks.environment`, `hooks.afterEnvironment`, `hooks.initialize`.

`MultiCompiler` would be created if the options is an array of multiple options. This type of compiler is build upon `Compiler` with some tweaks.

Anyway, when the compiler is available, it's time to run in normal mode via `compiler.run()` or watch mode `compiler.watch()`.

#### `Compiler`

```js
// in lib/webpack.js, createCompiler
const compiler = new Compiler(options.context);
compiler.options = options;
```

When created, the `Compiler` instance is almost a collection of lots of configurations with default values.

More details on `hooks` later. Before that, It's important to take a look at [`tapable`](https://github.com/webpack/tapable).

> Understanding how `tapable` works is quite helpful when figuring out how webpack works. It's the backbone of webpack anyway. References: [compiler hooks](https://webpack.js.org/api/compiler-hooks/), [compilation hooks](https://webpack.js.org/api/compilation-hooks/), [JavascriptParser Hooks](https://webpack.js.org/api/parser/).

Since we have the `Compiler` instance, it's time to register plugins into the instance, aka, _tap into hooks_.

```js
new NodeEnvironmentPlugin({
  infrastructureLogging: options.infrastructureLogging,
}).apply(compiler);
```

`NodeEnvironmentPlugin` basically inject the some filesystem utils, whether wrapped or not, `inputFileSystem`, `outputFileSystem`, `watchFileSystem` , into the instance.

```js
/**
 * plugins defined in config
 */
if (Array.isArray(options.plugins)) {
  for (const plugin of options.plugins) {
    if (typeof plugin === 'function') {
      plugin.call(compiler, compiler);
    } else {
      plugin.apply(compiler);
    }
  }
}
```

> It's not surprise that you have to write an `apply` method in plugin class defintions.

#### `compiler.run()`

After some necessary checks and closure functions, the compiler would trigger `beforeRun`, `run` hooks, at the callback, the compiler invoke the `readRecords` methods, and in its callback, the real `compile` (a method of the compiler) is called.

**`readRecords`**

It will check the `recordsInputPath`, which is a JSON file, to load the previous records. [Related documentation](https://webpack.js.org/configuration/other-options/#recordspath)

**`compile`**

Finally, we are going to _compile_ something.

- `beforeCompile` hook is taped
- `compile` hook is taped
- `compilation` is created to do some compile works, heavy works, which is an instance of `lib/Compilation.js`. The function `compilation.finish` and `compliation.seal` are called.
- after compilation, `emitAssets`,
- add additional compilation round.

**`compilation`**

`Compilation` can:

- `processModuleDependencies`
- `buildModule`
- `addRuntimeModule`
- `createModuleHashes`
- `emitAsset`
- `codeGeneration`
- `addChunk`, `addChunkInGroup`
- `processRuntimeRequirements`
- generate `Stats`
- `finish` to build moduleGraph
- `seal` to
  - optimize dependencies
  - create chunks
  - optimize modules and chunks
  - assign ids to module/chunk
  - hash module and chunks
  - code generation, it's a long way to get here :).
  - runtime requirements, hashing,
  - tackle module assets, chunk assets,
- ...

#### `compiler.watch()`

This would return a compiler watcher (a `Watching` instance defined in `lib/Watching.js`) if successfully executed.

The watch instance would invoke `compiler.compiler()` after the `hook.watchRun` is triggered. And after each `emitRecords` from compiler, after some necessary checks, the watcher would invoke `compiler.compile` again to rebuild. And the rest is much like the `compiler.run()`

## Webpack in CLI

`webpack-cli` is a [monorepo](https://github.com/webpack/webpack-cli). Navigate to the package directory at `package/webpack-cli`.

The entry file is located at `bin/cli.js`, and the real work is done by `lib/webpack-cli.js`, before which there's a _bootstrape_ stage (`lib/bootstrap.js`) to deal with the arguments coming from command line input.

During bootstrap, a `WebpackCLI` instance would be created, and `WebpackCLI.run()` starts the _webpack_ job.

Aha, in the `run` method, the cli first resolve the `config` options, pass it to create a webpack compiler using the `webpack` package. And it's where all the dirty work done by webpack. we have already talked about how webpack does its work in previous section.

Besides calling `webpack` from command line, `WebpackCLI` also provides many useful commands to:

- Init a webpack config, `webpack-cli init`
- Scaffold a loader repository template, `webpack-cli loader`
- Scaffold a plugin repository template, `webpack-cli plugin`
- Inspect system information and dependencies, `webpack-cli info`
- Run webpack Dev Server, `webpack-cli server`

> [Yeoman](https://yeoman.io/learning/) is used for generating loader/plugin repository.

More detailed usage could be found [here](https://webpack.js.org/api/cli/).

## Webpack on the Fly

`webpack-dev-server` is a development server that provides live reloading.

The entry point is `lib/Server.js`. It's create a node server using express.

Inside the `constructor()`, the server would:

- hooks into webpack `compiler` lifecycle,
- initialize the application using `express`, which will serve as for `http.server`
- set up host check middleware, `server.checkHost()`
- set up development middleware using `webpack-dev-middleware`
- enable feature middlewares according to the given options, such as _webpack-dev-middleware_, _compression_, _proxy_, _historyApiFallback_
- optinally set up https configuration
- create the server using `http.createServer`
- set up some supplementary routes, `lib/utils/routes.js`
- set server sockets graceful killable
- set up websocketProxies, [details](https://github.com/chimurai/http-proxy-middleware#external-websocket-upgrade)

This server cand send data to page via sockets connection.

> For example, if watching on static files is enabled, when these files change, the server would send `'content-change'` event to its sockets.

### webpack-dev-middleware

This is an express-style development middleware for use with webpack bundles and allows for serving of the files emitted from webpack.

Some of the benefits of using this middleware include:

- No files are written to disk, rather it handles files in memory
- If files changed in watch mode, the middleware delays requests until compiling has completed.
- Supports hot module reload (HMR).

The entry file is `src/index.js` which is a function, accepting two parameters, `compiler` instance created by webpack, and optional `options` object.

Again, `webpack-dev-middleware` hooks into webpack `compiler` lifecycle, doing its work after some hooks triggered.

The real middleware function is defined at `src/middleware.js`. While handling the valid requests, the response content is read from the webpack `compiler`'s `outputFileSystem`. `setupOutputFileSystem` (`src/utils/setupOutputFileSystem.js`) does the trick.

```js
try {
  content = context.outputFileSystem.readFileSync(filename);
} catch (_ignoreError) {
  await goNext();
  return;
}
```

So whenever the webpack `compiler` compiles something new:

1. the `webpack-dev-server` would send sockets data to the front client
1. client refresh its pages, re-request data
1. server read the new content from `compiler.outputFileSystem` with the help of `webpack-dev-middleware`, response with new data

## Hack with webpack

There are two major ways to play with webpack:

1. Tap into the webpack hooks
1. Tap into the compilation hooks

These commands would create a plugin/loader project using webpack-cli plugin/loader templates.

```bash
# install webpack-cli @webpack-cli/generate-plugin
./node_modules/.bin/webpack-cli plugin

# install webpack-cli @webpack-cli/generate-loader
./node_modules/.bin/webpack-cli loader
```

Detailed documentations for [plugin](https://webpack.js.org/contribute/writing-a-plugin/) and [loader](https://webpack.js.org/contribute/writing-a-loader).

Tricky for writing composed plugins:

```js
// some-plugin/src/index.js
const debug = require('debug')('someplugin');
const { DefinePlugin } = require('webpack');

class SomePlugin {
  constructor(options) {
    this.options = options;
    // ...
  }
  apply(compiler) {
    debug('apply function from bundlesize plugin');
    // some plugin functionality
    compiler.hooks.some.tap('SomePlugin', (...args) => {
      debug('compiler some hook!');
    });
    // compose other plugins
    // for example
    new DefinePlugin({
      MAGIC_VALUE: JSON.stringify('magic_value'),
    }).apply(compiler);
  }
}

module.exports = SomePlugin;
```

## Utilities

- [webpack-sources](https://github.com/webpack/webpack-sources)
- [stats analyse](https://github.com/webpack/analyse)
- [enhanced-resolve](https://github.com/webpack/enhanced-resolve)
