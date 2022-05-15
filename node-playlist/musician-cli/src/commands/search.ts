import {CliUx, Command, Flags} from '@oclif/core'
import {ISong} from '../types'
import {searchSong} from '../utils/migu-songs'

export default class Search extends Command {
  static description = 'Search by song name or singer name';

  static examples = ['<%= config.bin %> <%= command.id %> 周杰伦'];

  static flags = {
    pageSize: Flags.integer({
      default: 10,
      description: 'page size',
    }),
    page: Flags.integer({
      default: 1,
      description: 'page number',
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
    const {args, flags} = await this.parse(Search)
    // this.debug(args, flags);

    const {songResultData} = await searchSong(
      args.keyword,
      flags.page,
      flags.pageSize,
    )

    const {result = []} = songResultData
    if (result.length === 0) {
      this.log('No match!')
      return
    }

    CliUx.ux.table(
      result,
      {
        singer: {
          get: (row: ISong) => row.singers?.[0]?.name,
        },
        name: {},
      },
      {
        printLine: this.log.bind(this),
        ...flags, // parsed flags
      },
    )
  }
}
