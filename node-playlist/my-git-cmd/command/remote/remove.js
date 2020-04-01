'use strict';

const Command = require('common-bin');

class RemoveCommand extends Command {
  *run({ argv }) {
    console.log('git remote remove %s', argv._[0]);
  }

  get description() {
    return 'Remove the remote named <name>';
  }
}

module.exports = RemoveCommand;
