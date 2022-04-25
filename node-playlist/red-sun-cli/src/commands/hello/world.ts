import { CliUx, Command } from '@oclif/core';

export default class World extends Command {
  static description = 'Say hello world';

  static examples = [
    `$ oex hello 42
hello 42! (./src/commands/hello/world.ts)
`,
  ];

  static flags = {};

  static args = [];

  async run(): Promise<void> {
    this.warn('uh oh!')
    this.log('hello 42 (./src/commands/hello/world.ts)')
     // start the spinner
     CliUx.ux.action.start('starting a process')
     // do some action...
     await new Promise((resolve, reject) => {
       setTimeout(resolve, 3000);
     });

     // stop the spinner
     CliUx.ux.action.stop() // shows 'starting a process... done'

     // show on stdout instead of stderr
     CliUx.ux.action.start('starting a process', 'initializing', {stdout: true})
     await new Promise((resolve, reject) => {
       setTimeout(resolve, 3000);
     });

     // stop the spinner with a custom message
     CliUx.ux.action.stop('custom message') // shows 'starting a process... custom message'
  }
}
