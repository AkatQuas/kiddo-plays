# Verdaccio and Lerna

[Verdaccio](https://verdaccio.org/en/) is a lightweight open source private npm proxy registry.

[Lerna](https://github.com/lerna/lerna/) is a tool for managing JavaScript projects with multiple packages.

[Gitea](https://try.gitea.io/) is a painless, self-hosted Git service, just for quick git usage since lerna project should be a git repositry.

## Installation

```bash
# install lerna@^4.0.0
npm install -g lerna@^4.0.0

docker image pull verdaccio/verdaccio

# if using tagged image
docker pull verdaccio/verdaccio:4

# create a npm registry file in the project
echo "registry=http://localhost:4873/" >> .npmrc

# for quick git service
docker image pull gitea/gitea:1.12.4

# database for git service
docker image pull mariadb:10
```

## Get Started

```bash
# start the registry,git
make start-env

# add user for npm so that packages could be published
npm adduser --registry http://localhost:4873

# navigate to create git service
open http://localhost:7000/user/sign_up

# init a lerna project
npx lerna init

# independent packages
npx lerna init --independent
```

## Development

```bash
npx lerna create <package>

# link packages in dependencies
# necessary to list those dependencies clearly
npx lerna link

# add dependencies in a certain package you are developing
# make sure you are under that package folder
pwd # /path/packages/<some-package>
npx lerna add <dependencies>[@version] [--dev] [--exact] [--peer]
```

## Publish

```bash
npx lerna publish

# git commit is automatically committed and pushed
```

## Clean

```bash
npx lerna clean

make clean-env
```

## Documents for lerna

```txt
Usage: lerna <command> [options]

Commands:
  lerna add <pkg> [globs..]  Add a single dependency to matched packages
  lerna bootstrap            Link local packages together and install remaining package dependencies
  lerna changed              List local packages that have changed since the last tagged release    [aliases: updated]
  lerna clean                Remove the node_modules directory from all packages
  lerna create <name> [loc]  Create a new lerna-managed package
  lerna diff [pkgName]       Diff all packages or a single package since the last release
  lerna exec [cmd] [args..]  Execute an arbitrary command in each package
  lerna import <dir>         Import a package into the monorepo with commit history
  lerna info                 Prints debugging information about the local environment
  lerna init                 Create a new Lerna repo or upgrade an existing repo to the current version of Lerna.
  lerna link                 Symlink together all packages that are dependencies of each other
  lerna list                 List local packages                                                 [aliases: ls, la, ll]
  lerna publish [bump]       Publish packages in the current project.
  lerna run <script>         Run an npm script in each package that contains that script
  lerna version [bump]       Bump version of packages changed since the last release.
```

