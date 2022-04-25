# oclif-red-sun-cli

**Just follow the [document](https://oclif.io/docs/introduction).**

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/oclif-hello-world.svg)](https://npmjs.org/package/oclif-hello-world)
[![CircleCI](https://circleci.com/gh/oclif/hello-world/tree/main.svg?style=shield)](https://circleci.com/gh/oclif/hello-world/tree/main)
[![Downloads/week](https://img.shields.io/npm/dw/nprogresse.svg)](https://npmjs.org/package/nprogresse)
[![Downloads/week](https://img.shields.io/npm/dw/vue-visibility-sensor.svg)](https://npmjs.org/package/vue-visibility-sensor)
[![License](https://img.shields.io/npm/l/oclif-hello-world.svg)](https://github.com/oclif/hello-world/blob/main/package.json)

<!-- toc -->

- [Usage](#usage)
- [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->

```sh-session
$ npm install -g red-sun-cli
$ redsun COMMAND
running command...
$ redsun (--version)
red-sun-cli/0.0.0 darwin-x64 node-v14.19.1
$ redsun --help [COMMAND]
USAGE
  $ redsun COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

- [`redsun hello PERSON`](#redsun-hello-person)
- [`redsun hello world`](#redsun-hello-world)
- [`redsun help [COMMAND]`](#redsun-help-command)
- [`redsun plugins`](#redsun-plugins)
- [`redsun plugins:install PLUGIN...`](#redsun-pluginsinstall-plugin)
- [`redsun plugins:inspect PLUGIN...`](#redsun-pluginsinspect-plugin)
- [`redsun plugins:install PLUGIN...`](#redsun-pluginsinstall-plugin-1)
- [`redsun plugins:link PLUGIN`](#redsun-pluginslink-plugin)
- [`redsun plugins:uninstall PLUGIN...`](#redsun-pluginsuninstall-plugin)
- [`redsun plugins:uninstall PLUGIN...`](#redsun-pluginsuninstall-plugin-1)
- [`redsun plugins:uninstall PLUGIN...`](#redsun-pluginsuninstall-plugin-2)
- [`redsun plugins update`](#redsun-plugins-update)

## `redsun hello PERSON`

Say hello

```
USAGE
  $ redsun hello [PERSON] -f <value>

ARGUMENTS
  PERSON  Person to say hello to

FLAGS
  -f, --from=<value>  (required) Whom is saying hello

DESCRIPTION
  Say hello

EXAMPLES
  $ oex hello friend --from oclif
  hello friend from oclif! (./src/commands/hello/index.ts)
```

_See code: [dist/commands/hello/index.ts](https://github.com/AkatQuas/red-sun-cli/blob/v0.0.0/dist/commands/hello/index.ts)_

## `redsun hello world`

Say hello world

```
USAGE
  $ redsun hello world

DESCRIPTION
  Say hello world

EXAMPLES
  $ oex hello world
  hello world! (./src/commands/hello/world.ts)
```

## `redsun help [COMMAND]`

Display help for redsun.

```
USAGE
  $ redsun help [COMMAND] [-n]

ARGUMENTS
  COMMAND  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for redsun.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.1.10/src/commands/help.ts)_

## `redsun plugins`

List installed plugins.

```
USAGE
  $ redsun plugins [--core]

FLAGS
  --core  Show core plugins.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ redsun plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.0.11/src/commands/plugins/index.ts)_

## `redsun plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ redsun plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Installs a plugin into the CLI.

  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.

ALIASES
  $ redsun plugins add

EXAMPLES
  $ redsun plugins:install myplugin

  $ redsun plugins:install https://github.com/someuser/someplugin

  $ redsun plugins:install someuser/someplugin
```

## `redsun plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ redsun plugins:inspect PLUGIN...

ARGUMENTS
  PLUGIN  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ redsun plugins:inspect myplugin
```

## `redsun plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ redsun plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Installs a plugin into the CLI.

  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.

ALIASES
  $ redsun plugins add

EXAMPLES
  $ redsun plugins:install myplugin

  $ redsun plugins:install https://github.com/someuser/someplugin

  $ redsun plugins:install someuser/someplugin
```

## `redsun plugins:link PLUGIN`

Links a plugin into the CLI for development.

```
USAGE
  $ redsun plugins:link PLUGIN

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.

EXAMPLES
  $ redsun plugins:link myplugin
```

## `redsun plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ redsun plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ redsun plugins unlink
  $ redsun plugins remove
```

## `redsun plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ redsun plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ redsun plugins unlink
  $ redsun plugins remove
```

## `redsun plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ redsun plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ redsun plugins unlink
  $ redsun plugins remove
```

## `redsun plugins update`

Update installed plugins.

```
USAGE
  $ redsun plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

<!-- commandsstop -->
