import {expect, test} from '@oclif/test'

describe('search', () => {
  test
  .nock('https://pd.musicapp.migu.cn', api =>
    api
    .get(uri => uri.includes('/MIGUM3.0/v1.0/content/search_all.do'))
    .reply(200, {songResultData: {result: []}}),
  )
  .stdout()
  .command(['search', '周杰伦'])
  .it('runs search 周杰伦', ctx => {
    expect(ctx.stdout).to.contain('No match!')
  })
  test
  .nock('https://pd.musicapp.migu.cn', api =>
    api
    .get(uri => uri.includes('/MIGUM3.0/v1.0/content/search_all.do'))
    .reply(200, {songResultData: {result: []}}),
  )
  .stdout()
  .command(['search', '周杰伦'])
  .it('runs search 周杰伦', ctx => {
    expect(ctx.stdout).to.contain('No match!')
  })

  test
  .nock('https://pd.musicapp.migu.cn', api =>
    api
    .get(uri => uri.includes('/MIGUM3.0/v1.0/content/search_all.do'))
    .reply(200, {
      songResultData: {
        result: [{name: '发如霜', singers: [{name: '李克勤'}]}],
      },
    }),
  )
  .stdout()
  .command(['search', '发如霜'])
  .it('runs search 发如霜', ctx => {
    expect(ctx.stdout).to.match(/李克勤\s+发如霜/)
  })

  test
  .nock('https://pd.musicapp.migu.cn', api =>
    api
    .get(uri => uri.includes('/MIGUM3.0/v1.0/content/search_all.do'))
    .reply(200, {
      songResultData: {
        result: [
          {name: '发如霜', singers: [{name: '李克勤'}]},
          {name: '红日', singers: [{name: '周杰伦'}]},
        ],
      },
    }),
  )
  .stdout()
  .command(['search', '发如霜'])
  .it('runs search 发如霜', ctx => {
    expect(ctx.stdout).to.match(/李克勤\s+发如霜/)
    expect(ctx.stdout).to.match(/周杰伦\s+红日/)
  })
})
