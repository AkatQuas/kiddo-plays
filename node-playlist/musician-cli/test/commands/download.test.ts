import {Interfaces} from '@oclif/core'
import {expect, test} from '@oclif/test'
import * as inquirer from 'inquirer'
import * as os from 'node:os'

const dTest = test.register(
  'customConfig',
  (fn: (config: Interfaces.Config) => Interfaces.Config) => {
    return {
      async run(ctx: { config: Interfaces.Config; expectation: string }) {
        ctx.config = fn(ctx.config)
      },
    }
  },
)

describe('download', () => {
  dTest
  .nock('https://pd.musicapp.migu.cn', api =>
    api
    .get(uri => uri.includes('/MIGUM3.0/v1.0/content/search_all.do'))
    .reply(200, {songResultData: {result: []}}),
  )
  .stdout()
  .command(['download', '周杰伦'])
  .it('runs download 周杰伦 with no result', ctx => {
    expect(ctx.stdout).to.contain('No match!')
  })

  dTest
  .nock('https://pd.musicapp.migu.cn', api =>
    api
    .get(uri => uri.includes('/MIGUM3.0/v1.0/content/search_all.do'))
    .reply(200, {
      songResultData: {
        result: [
          {
            name: '发如霜',
            contentId: '1',
            singers: [{name: '周杰伦'}],
          },
        ],
      },
    }),
  )
  .nock('http://app.pd.nf.migu.cn/', api => {
    api
    .get(uri => uri.includes('/MIGUM2.0/v1.0/content/sub/listenSong.do'))
    .reply(200, Buffer.from('1234'))
  })
  .loadConfig()
  .customConfig(c => {
    c.dataDir = os.tmpdir()
    return c
  })
  .stdout()
  .command(['download', '周杰伦', '--urlVersion=v2'])
  .it('runs download 周杰伦 using versionV2', ctx => {
    expect(ctx.stdout).to.match(/Downloaded to.+周杰伦-发如霜\.mp3/)
  })

  dTest
  .nock('https://pd.musicapp.migu.cn', api =>
    api
    .get(uri => uri.includes('/MIGUM3.0/v1.0/content/search_all.do'))
    .reply(200, {
      songResultData: {
        result: [
          {
            name: '发如霜',
            singers: [{name: '周杰伦'}],
            newRateFormats: [
              {
                androidUrl: 'http://localhost:8080/aaa123',
              },
            ],
          },
        ],
      },
    }),
  )
  .nock('https://freetyst.nf.migu.cn', api => {
    api.get('/aaa123').reply(200, Buffer.from('1234'))
  })
  .loadConfig()
  .customConfig(c => {
    c.dataDir = os.tmpdir()
    return c
  })
  .stdout()
  .command(['download', '周杰伦'])
  .it('runs download 周杰伦 using versionV1 and 1 match result', ctx => {
    expect(ctx.stdout).to.match(/Downloaded to.+周杰伦-发如霜\.mp3/)
  })

  dTest
  .nock('https://pd.musicapp.migu.cn', api =>
    api
    .get(uri => uri.includes('/MIGUM3.0/v1.0/content/search_all.do'))
    .reply(200, {
      songResultData: {
        result: [
          {
            name: '发如霜',
            singers: [{name: '周杰伦'}],
            newRateFormats: [
              {
                androidUrl: 'http://localhost:8080/aaa123',
              },
            ],
          },
          {
            name: '发如霜2',
            singers: [{name: '周杰伦'}],
            newRateFormats: [
              {
                androidUrl: 'http://localhost:8080/aaa123',
              },
            ],
          },
        ],
      },
    }),
  )
  .nock('https://freetyst.nf.migu.cn', api => {
    api.get('/aaa123').reply(200, Buffer.from('1234'))
  })
  .stub(inquirer, 'prompt', () => Promise.resolve({index: 1}))
  .loadConfig()
  .customConfig(c => {
    c.dataDir = os.tmpdir()
    return c
  })
  .stdout()
  .command(['download', '周杰伦'])
  .it('runs download 周杰伦 using versionV1 and 2 match result', ctx => {
    expect(ctx.stdout).to.match(/Downloaded to.+周杰伦-发如霜2\.mp3/)
  })
})
