# vue-exec-1

> vue exercise project 1, following the tutorial `The Complete Guide (incl. Vuex)`.

## Build Setup

``` bash
# install vue-router
npm install --save vue-router

# install babel-preset-stage-2
npm install  --save-dev babel-preset-stage-2

# install vuex
npm install --save vuex

# install dependencies
npm install

# serve with hot reload at localhost:8080
npm run dev

# build for production with minification
npm run build
```
###Tips
1. Setup your routes clearly, config the routes and router.
2. Write some simple text in the components so you can make sure that you have the correct router links.
3. Think about the data, install the `vuex`, than make up some dummy data, config the `state`, using modules if possible. Make sure you have all the `mutations`, `actions`, `getters` , `state` in your modules js files. When using the state, remember to initialize the data by committing some methods.
4. The mutations functions can be dispatched between modules in the store.
5. Add some checks so these UI won't be illogical.
6. Add a global filter.
7. When calling the `actions` or `mutations` in the `store`, you need to import the `{mapActions}` first. The same way to access to the getters is using `{mapGetters}`.
8. Using `vue-resource` to send HTTP request. In this case, we don't have the access to the firebase.com in China, so it is better to learn how the HTTP request works.
9. You can change the function used in `computed` object to a object with two functions, `get()` and `set()`, so you can use it in two-way binging values. Find it in `App.vue` file to have a taste on this trick. Here is the [doc](https://vuex.vuejs.org/zh-cn/forms.html)
10. It is always a good idea to use `getters` to get the `state` from `$store`, especially when you spilt the codes into separate modules.

For detailed explanation on how things work, consult the [docs for vue-loader](http://vuejs.github.io/vue-loader).
