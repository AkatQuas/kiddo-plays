#!/usr/bin/env node
const spawn = require('child_process').spawn;
const chokidar = require('chokidar');
const path = require('path');

class Nodekeeper {
  constructor() {
    this._init();
  }
  _init() {
    this.args = process.argv;
    this.fileName = this.args[2];
    this.cwd = process.cwd();
    this.watchPaths = [path.resolve(this.cwd, '**/*.js')];
    this.ignoredPaths = '**/node_modules/*';

    this.reload();
    this.startWatching();
    this.listeningEvents();
  }
  reload() {
    this.stopChild();
    this.nodeServer = spawn('node', [this.fileName], {
      stdio: 'inherit',
    });
  }
  stopChild() {
    if (this.nodeServer) {
      this.nodeServer.kill('SIGTERM');
    }
  }
  startWatching() {
    chokidar
      .watch(this.watchPaths, {
        ignored: this.ignoredPaths,
        ignoreInitial: true,
      })
      .on('all', (event, path) => {
        this.reload();
      });
  }
  listeningEvents() {
    // listening on CLI input
    process.stdin.on('data', (chunk) => {
      const cliInput = chunk.toString();
      switch (cliInput) {
        case 'rs\n':
          this.reload();
          break;
        case 'quit\n':
          this.stopChild();
          process.exit(0);
        default:
          break;
      }
    });
  }
}
function main() {
  const keeper = new Nodekeeper();

  process.on('SIGINT', () => {
    keeper.stopChild();
    process.exit(0);
  });
}
main();
