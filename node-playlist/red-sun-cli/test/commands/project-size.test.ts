import {expect, test} from '@oclif/test'

describe('project-size', () => {
  test
  .stdout()
  .command(['project-size'])
  .it('runs hello', ctx => {
    expect(ctx.stdout).to.contain('hello world')
  })

  test
  .stdout()
  .command(['project-size', '--label', 'jeff'])
  .it('runs hello --label jeff', ctx => {
    expect(ctx.stdout).to.contain('hello jeff')
  })

  test
  .stdout()
  .command(['project-size', 'small', '--label', 'qop'])
  .it('runs small --label qop', ctx => {
    expect(ctx.stdout).to.contain('hello qop')
  })
  test
  .stdout()
  .command(['project-size', 'small', '--label', 'qop', '--force'])
  .it('runs small --label qop --force', ctx => {
    expect(ctx.stdout).to.contain('hello qop')
    expect(ctx.stdout).to.contain('--force and --file: small')
  })
})
