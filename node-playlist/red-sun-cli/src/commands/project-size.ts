import {Command, Flags} from '@oclif/core'

export default class ProjectSize extends Command {
  static description = 'describe the command here';

  static examples = ['<%= config.bin %> <%= command.id %>'];

  static flags = {
    // flag with a value (-n, --name=VALUE)
    label: Flags.string({char: 'n', description: 'name to print'}),
    // flag with no value (-f, --force)
    force: Flags.boolean({char: 'f'}),
  };

  static args = [{name: 'file'}];

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(ProjectSize)

    const name = flags.label ?? 'world'
    this.log(
      `hello ${name} from /Users/akat/workspace/akat-play/red-sun-cli/src/commands/project-size.ts`,
    )
    if (args.file && flags.force) {
      this.log(`you input --force and --file: ${args.file}`)
    }
  }
}
