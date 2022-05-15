import {CliUx, Command, Flags} from '@oclif/core'
import * as inquirer from 'inquirer'
import {ISong} from '../types'
import {
  downloadSong,
  generateURL,
  generateURL2,
  searchSong,
} from '../utils/migu-songs'

export default class Download extends Command {
  static description = 'Download Song from list searched by keyword';

  static examples = [
    '<%= config.bin %> <%= command.id %> download 发如雪',
    '<%= config.bin %> <%= command.id %> download 发如雪 --SQ',
    '<%= config.bin %> <%= command.id %> download 发如雪 --urlVersion=v2',
  ];

  static flags = {
    urlVersion: Flags.string({
      options: ['v1', 'v2'],
      default: 'v1',
      description: 'URL generate Version',
    }),
    SQ: Flags.boolean({
      default: false,
      description: 'Lossless Quality',
    }),
  };

  static args = [
    {
      name: 'keyword',
      required: true,
      description: 'Song name or singer name as keyword',
    },
  ];

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(Download)
    const {songResultData} = await searchSong(args.keyword)
    const {result = []} = songResultData

    if (result.length === 0) {
      this.log('No match!')
      return
    }

    const index = await this._getDownloadIndex(result)
    const url =
      flags.urlVersion === 'v1' ?
        generateURL(result[index]) :
        generateURL2(result[index], flags.SQ)
    CliUx.ux.action.start('Downloading')
    const destination = await downloadSong(
      result[index],
      url,
      this.config.dataDir,
    )
    CliUx.ux.action.stop()
    this.log(`Downloaded to ${destination}`)
  }

  private async _getDownloadIndex(songs: ISong[]): Promise<number> {
    if (songs.length === 1) {
      return 0
    }

    const responses: any = await inquirer.prompt([
      {
        name: 'index',
        message: 'Select a song to download',
        type: 'list',
        choices: this._formatList(songs),
      },
    ])
    return responses.index
  }

  private _formatList(songs: ISong[]) {
    return songs.map((song, index) => ({
      name: `[${index + 1}] "${song.name}" - ${song.singers[0].name}`,
      value: index,
    }))
  }
}
