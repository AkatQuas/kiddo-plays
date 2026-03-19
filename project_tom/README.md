# Project Tom

This is full stack monorepo for Project Tom, check the [Practice.md](docs/practice.md) for why this project exists.

## Applications

xxx, website and server

## Libraries

### @tom_ai/intensity

`@tom_ai/intensity` is a private package both for front and server side. Add `"@tom_ai/intensity": "workspace:*"` to dependencies to use the source code among the workspace.

Also, this is the naive demo project to illustrate our encouraging coding practice, including code organization, readability, documentation, testing, etc.

[Go to package ↗️](./libs/intensity/).

## Development

### Prerequisite

Node >= 20, pnpm >= 9.15

### Get Started

VS Code is recommended. (Or any other editor based on VS Code OSS)

Open an empty VSCode window.\
Select the menu _File_ from the top status bar, `File -> Open Workspace from File...`,\
pick the `project.code-workspace` file.

General configurations are saved at **[project.code-workspace](./project.code-workspace)** for monorepo maintenance.

Still, there could be a `.vscode` folder for sub project to configure their own settings / tasks / launches configurations.

### Structure brief

```bash
Project_Tom/
  ├─ apps/                   # source for applications
  │  ├─ website/             # website, next js
  │  ├─ server/              # server, currently in nodejs, plan to migrate to golang
  ├─ libs/                   # source for libraries, sdk, utilities
  │  ├─ config/              # shared config files, eslintrc, tsconfig, etc
  │  ├─ intensity/           # intensity manager, an npm package
  │  ├─ types/               # shared typing definitions
  ├─ scripts/                # script files for CI/CD
  ├─ .env                    # env variables
  ├─ .gitignore
  ├─ project.code-workspace  # vscode workspace config
  ├─ pnpm-workspace.yaml     # pnpm workspace config
  ├─ README.md
  ├─ ...
  │
  ├─ Makefile                # legacy configuration for non-vscode user, neovim for example
  ├─ Procfile                # legacy configuration
```
