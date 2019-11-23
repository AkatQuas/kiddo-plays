# myproject

> A learning project with Vuex-Centralize State

## tips

In store.js, you can config one state object, 'store' in this case.
Then you can store the data in store.state, and using getters to compute some state data.
You can access to these computed data via mapGetters which is an Object holding many functions from vuex.

    computed: mapGetters({
                   propertyName: 'dataInStore.Gettes'
               })
    
Sometimes we may want our own computed properties besides mapGetters. Using the following snippets instead.
    
    computed: {
        ...mapGetters([
            'doubleCounter',
            'stringCounter'
        ]),
        ourOwn() {
            return 123;
        }
    }

To deal with the ... syntax, we need to install an npm package.
 
 ``` bash
 # install babel-preset-stage-2
 npm install --save-dev babel-preset-stage-2
 ``` 
 
And config the .babelrc file.
 
    {
      "presets": [
        ["latest", {
          "es2015": { "modules": false }
        }],
        ["stage-2"]
      ]
    }

 
Check out AnotherResult.vue carefully.

Using mutation, you can reuse the functions in the vuex. Also `mapMutations` works in the same way as `mapGetters`. In one statement block, you can modify once for all.

Basically, mutations have to work synchronously! You may not have any asynchronous statement in the mutation functions. 

But! You can use Actions to execute some asynchronous code and then execute the mutation functions.

Check out the `store/store.js` and `components/AnotherCounter.vue`

In Actions, vueJS can automatically help you to pass the params to the Actions functions, check out the AnotherCounter 

## Summary

1. Start with a `store`, store some `states` in the object.

1. Set up `getters` with reusable code to accessing the `states` in the `store` in the components. You can use `mapGetters` in the components to get access to the full `getters`.

1.  Use `mutations` to manipulate the `states` and overwrite them. You can pass some params to these `mutations` as well. To execute these `mutations` functions, you need to use the method `commit`!

1.  With `Actions` you can execute some asynchronous codes.

## Folder Structure tips:

1.  Create a directory in `store` called `modules`.

1.  Config some basic methods in these `[state].js`, remember to export them out!

1.  Import the `[state].js` and merge it in the main `store.js` in the modules property.

Similarly, separate the common `getters`, `mutaions`, `actions` in different files, and import them in the `store.js`.

Check out the `counter.js` carefully.


I have some extra npm package besides the [webpack-simple](https://github.com/vuejs-templates/webpack-simple) boilerplate. In this project, the dependencies is already written well. You can just bash 'npm install'.

``` bash
# install vue-resource
npm install --save vue-resource

# install vue-router
mpm install --save vue-router

# install vuex
npm install --save vuex
``` 

## Build Setup

``` bash
# install dependencies
npm install

# serve with hot reload at localhost:8080
npm run dev

# build for production with minification
npm run build
```

For detailed explanation on how things work, consult the [docs for vue-loader](http://vuejs.github.io/vue-loader).
