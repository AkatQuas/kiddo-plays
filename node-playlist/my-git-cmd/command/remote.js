'use strict';

const path = require('path');
const Command = require('common-bin');

class RemoteCommand extends Command {
  constructor(rawArgv) {
    super(rawArgv);
    this.yargs.usage('Usage: my-git-cmd remote <add/remove>');
    this.load(path.join(__dirname, 'remote'));
    this.alias('rm', 'remove');
  }

  * run(context) {
    const { argv } = context;
    console.log('run remote command with %j', argv._);
  }

  get description() {
    return 'Manage set of tracked repositories';
  }
}

module.exports = RemoteCommand;
