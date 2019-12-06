'use strict';

const Command = require('common-bin');

class AddCommand extends Command {
  constructor(rawArgv) {
    super(rawArgv);

    this.usage = 'Usage: my-git-cmd remote add <name> <url>';
    this.options = {
      tags: {
        type: 'boolean',
        alias: 't',
        default: false,
        description: 'imports every tag from the remote repository',
      },
      'debug-ab': {
        type: 'boolean',
        alias: 'd',
        default: false,
        description: 'imports every tag from the remote repository',
      },
    };
  }

  * run(context) {
    const { argv } = context;
    console.log('git remote add %s to %s with tags=%s', argv._[0], argv._[1], argv.tags);
  }

  get description() {
    return 'Adds a remote named <name> for the repository at <url>';
  }
}

module.exports = AddCommand;
