'use strict';

const path = require('path');
const Command = require('common-bin');

class MainCommand extends Command {
  constructor(rawArgv) {
    super(rawArgv);

    this.usage = 'Usage: my-git-cmd <command> [options]';

    this.load(path.join(__dirname, 'command'));
  }
}

module.exports = MainCommand;
