'use strict';

const Command = require('common-bin');

class CloneCommand extends Command {
  constructor(rawArgv) {
    super(rawArgv);
    this.yargs.usage('clone <repository> <directory>')
    this.yargs.options({
      depth: {
        type: 'number',
        default: 1,
        description: 'Create a shallow clone with a history truncated to the specified number of commits',
      },
    });
  }

  * run(context) {
    const { argv } = context;
    console.log(argv);
    console.log('git clone %s to %s with depth %d', argv._[0], argv._[1], argv.depth);
  }

  get description() {
    return 'Clone a repository into a new directory';
  }
}

module.exports = CloneCommand;
