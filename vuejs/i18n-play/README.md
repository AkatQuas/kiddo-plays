# i18n-play

> A Vue.js project

Using `gulp` to watch the `locales` directory changes while developing.

Although I have implemented `locales` hot-reload with gulp watching, the [official document](http://kazupon.github.io/vue-i18n/guide/hot-reload.html) gives another approach.
# Tips 

- For [vue-cli 3.0](http://kazupon.github.io/vue-i18n/guide/sfc.html#vue-cli-3-0-beta)

- For [XSS defence](http://kazupon.github.io/vue-i18n/guide/interpolation.html#basic-usage)

- Writing locales in [Single File Component](http://kazupon.github.io/vue-i18n/guide/sfc.html): a `@kazupon/vue-i18n-loader` is required, 

## Build Setup

``` bash
# install dependencies
npm install

# serve with only vue, without watching the locales directory
npm run dev:vue

# serve with hot reload at localhost:8080
npm run dev

# build the locale.message.json
npm run build:locales

# build the vue project
npm run build:vue

# build for the whole production with minification
npm run build

# build for production and view the bundle analyzer report
npm run build --report
```

For a detailed explanation on how things work, check out the [guide](http://vuejs-templates.github.io/webpack/) and [docs for vue-loader](http://vuejs.github.io/vue-loader).
