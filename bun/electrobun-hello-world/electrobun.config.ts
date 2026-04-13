import type { ElectrobunConfig } from 'electrobun';

export default {
  app: {
    name: 'Hello Electrobun',
    identifier: 'dev.akat.hello_electrobun',
    version: '0.0.1'
  },
  build: {
    /*
    Core dependencies not found for macos-arm64. Missing files: ./dist-macos-arm64/bun, ./dist-macos-arm64/bsdiff, ./dist-macos-arm64/bspatch, ./dist-macos-arm64/launcher, ./dist-macos-arm64/libNativeWrapper.dylib
    Downloading core binaries for macos-arm64...
    Downloading core binaries from: https://github.com/blackboardsh/electrobun/releases/download/v1.16.0/electrobun-core-darwin-arm64.tar.gz
    */
    bun: {
      entrypoint: 'src/bun/index.ts'
    },
    views: {
      'main-ui': {
        entrypoint: 'src/main-ui/index.ts'
      }
    },
    copy: {
      'src/main-ui/index.html': 'views/main-ui/index.html',
      'src/main-ui/index.css': 'views/main-ui/index.css',
      'src/child-ui/index.html': 'views/child-ui/index.html',
      'src/child-ui/index.css': 'views/child-ui/index.css'
    },
    mac: {
      // Downloading CEF (attempt 1/3) from: https://github.com/blackboardsh/electrobun/releases/download/v1.16.0/electrobun-cef-darwin-arm64.tar.gz
      bundleCEF: false
    },
    linux: {
      bundleCEF: false
    },
    win: {
      bundleCEF: false
    }
  }
} satisfies ElectrobunConfig;
