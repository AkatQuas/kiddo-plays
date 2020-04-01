# -------------------------------------------------------------------------------- basic
FROM node:10-alpine as basic

# * use aliyun alpine mirror
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

RUN apk add --no-cache git

WORKDIR /opt/app

RUN npm set registry https://registry.npm.taobao.org/ && \
    npm set disturl https://npm.taobao.org/dist && \
    npm set sass_binary_site https://npm.taobao.org/mirrors/node-sass

RUN apk add --no-cache --virtual .gyp python make g++ && \
    npm i -g npm@6.1.0

# -------------------------------------------------------------------------------- client
FROM basic as client

RUN npm i -g @angular/cli

COPY projects/client/package.json .
COPY projects/client/package-lock.json .

RUN npm install --verbose

COPY projects/client/src src
COPY projects/client/angular.json .
COPY projects/client/browserslist .
COPY projects/client/tsconfig.app.json .
COPY projects/client/tsconfig.json .

ENV NODE_ENV="production"

RUN npm run build

# -------------------------------------------------------------------------------- server
FROM basic as server

RUN npm i -g @nestjs/cli

COPY projects/server/package.json .
COPY projects/server/package-lock.json .


RUN npm install --verbose

COPY projects/server/src src
COPY projects/server/nest-cli.json .
COPY projects/server/tsconfig.json .
COPY projects/server/tsconfig.build.json .

ENV NODE_ENV="production"

RUN npm run build

COPY --from=client /opt/app/dist/client client

CMD npm run start:prod

EXPOSE 8080
