# oclif-migu-song

Search or download songs from [Migu Music](https://music.migu.cn/v3) built with [oclif](https://oclif.io/).

<!-- toc -->

- [oclif-migu-song](#oclif-migu-song)
- [Usage](#usage)
- [Commands](#commands)
- [Development](#development)
- [Acknowledgement](#acknowledgement)
<!-- tocstop -->

# Usage

<!-- usage -->

```sh-session
$ npm install -g musician
$ musician COMMAND
running command...
$ musician (--version)
musician/0.0.0 darwin-x64 node-v14.19.1
$ musician --help [COMMAND]
USAGE
  $ musician COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

- [`musician download KEYWORD`](#musician-download-keyword)
- [`musician help [COMMAND]`](#musician-help-command)
- [`musician search KEYWORD`](#musician-search-keyword)

## `musician download KEYWORD`

Download Song from list searched by keyword

```
USAGE
  $ musician download [KEYWORD] [--urlVersion v1|v2] [--SQ]

ARGUMENTS
  KEYWORD  Song name or singer name as keyword

FLAGS
  --SQ                   Lossless Quality
  --urlVersion=<option>  [default: v1] URL generate Version
                         <options: v1|v2>

DESCRIPTION
  Download Song from list searched by keyword

EXAMPLES
  $ musician download download 发如雪

  $ musician download download 发如雪 --SQ

  $ musician download download 发如雪 --urlVersion=v2
```

## `musician help [COMMAND]`

Display help for musician.

```
USAGE
  $ musician help [COMMAND] [-n]

ARGUMENTS
  COMMAND  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for musician.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.1.12/src/commands/help.ts)_

## `musician search KEYWORD`

Search by song name or singer name

```
USAGE
  $ musician search [KEYWORD] [--pageSize <value>] [--page <value>]

ARGUMENTS
  KEYWORD  Song name or singer name as keyword

FLAGS
  --page=<value>      [default: 1] page number
  --pageSize=<value>  [default: 10] page size

DESCRIPTION
  Search by song name or singer name

EXAMPLES
  $ musician search 周杰伦
```

<!-- commandsstop -->

# Development

- Use `DEBUG=musician:*` to display `debug` output in commands
- Run `oclif readme` after `oclif manifest` to update this `README.md`. This command requires `oclif.manifest.json` to update the _commands_ section in README.md.
- Remove `@oclif/plugin-plugins` under `oclif.plugins` in `package.json` to get rid of annoying plugins related commands in README.md. It's also possible to use `patch-package` to get rid of them.
- `oclif/test` is easy to play with. I have some stub, nock, and custom test plugin in [download.test.ts](./test/commands/download.test.ts) for you.
- Invoke `Config.load()` to get config programmatically when you're not inside `Command`.

  ```ts
  import { Config } from "@oclif/core";

  export async function test() {
    const config = await Config.load();
    // play with config
  }
  ```

# Acknowledgement

- [musicn](https://github.com/zonemeen/musicn)
- [migu_music](https://github.com/zhangx258/migu_music)
- [咪咕音乐链接歌词封面接口 API](https://www.liumingye.cn/archives/304.html)
