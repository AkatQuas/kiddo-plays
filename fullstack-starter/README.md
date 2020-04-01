# Fullstack Starter Project

# Foundation

This boilerplate is build on [Angular](https://angular.io/), [Ng-Zorro-Antd](https://ng.ant.design/docs/introduce/en) and [Nest](https://nestjs.com/).

# Setup

`setup_all.sh` helps to set the development environment up, including:

1. [commitizen](https://github.com/commitizen/cz-cli) for git commit message

1. [nginx](http://nginx.org/en/download.html) for universal gateway

1. [pm2](https://github.com/Unitech/pm2) for develop convenience

1. [proxychains4](https://github.com/rofl0r/proxychains-ng) for proxy

```bash
./setup_all.sh
```

# Development

Execute the `dev_all.sh` to develop.

```bash
./dev_all.sh
```

# Build or Deployment

Use docker for build. Please check the [DockerFile](./deploy/server/Dockerfile).
