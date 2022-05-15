# Addon demos

> Most examples could be found at [official document](https://nodejs.org/api/addons.html#addon-examples).

## Prerequisite

Make sure you have [`node-gyp`](https://github.com/nodejs/node-gyp) installed.

## Usage

Run `make test` to check the addon works well.

Run `make clean` to clear the built distributions.

Under the hood, you can split it into smaller steps

- Run `make config` to generate build scripts.

- Run `make build` to generate addons files
