const rollup = require('rollup')

/**
 * Using `rollup.watch` api to build in script files, more {@link https://rollupjs.org/guide/en/#rollupwatch  see this}
 * */

function watch() {
  const watchOptions = {}
  const watcher = rollup.watch(watchOptions)

  watcher.on('event', (event) => {
    // event.code can be one of:
    //   START        — the watcher is (re)starting
    //   BUNDLE_START — building an individual bundle
    //   BUNDLE_END   — finished building a bundle
    //   END          — finished building all bundles
    //   ERROR        — encountered an error while bundling
  })

  // at some time, stop watching
  watcher.close()
}
