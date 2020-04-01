# Deprecated myproject
Deprecated the project, more test or learning would be another [project](https://github.com/AkatQuas/vuetry) based on vue-webpack rather than vue-webpack-simple.

> A learning project with Vue-router based on webpack-simple template.

#tips

review the codes in routes.js, Header.vue, User.vue, UserDetail.vue carefully.

>Config your routes first.

Config the each link with ( path::string, component::module, [name::string, components::object, children::object] )

It is a good idea to name your routes, and use the name to navigate to the route when you want.

using hash tag, config the scrollBehavior

    scrollBehavior(to, from, savedPosition) {
        if (savedPosition) {
            return savedPosition;
        }
        if (to.hash) {
            return { selector: to.hash };
        }
        return { x: 0, y: 0 };
    }


In the router-tabs.js file use the following tags

    <router-link to="/{{path}}" tag="li"><a>Links</a><router-link>

Guards: with guards you can have some communication with the user.
1. beforeEach in the router config
2. beforeEnter in the module object.
3. beforeLeave in the module object.

In this routes, you can see a nested routes. So in the User.vue file you have to write a route-view tag to show the nested routes.
    
when switching between different paths using the same components, you may need to watch the '$route' object.

    '$route'(to, from) {
        console.log(to);
        console.log(from);
        this.id = to.params.id;
    }
    
A great idea is to create nested router links in you SPA, but it requires a clean and clear structure. Of course, too much nested routers makes your SPA much hard to develop.

>resolve methods, lazy-load the components and config the third argument, 'user' in this case, to bundle these files in one bundle js.

I have some extra npm package besides the [webpack-simple](https://github.com/vuejs-templates/webpack-simple) boilerplate. In this project, the dependencies is already written well. You can just bash 'npm install'.

``` bash
#install vue-resource
npm install --save vue-resource

#install vue-router
npm install --save vue-router
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

###Testing Update Log
1. 27 May 2017, [vue-qrcode](https://github.com/gerardreches/vue-qrcode-component) generating success! Modify the  `QRCode.vue` in this package (`node_modules\vue-qrcode-component\src`) to customize. Also, might as well to modify the `qrcode.js` in `node_modules\qrcode-js-package` to customize some style config, alignment for example.
```bash
#install vue-qrcode-component
npm install --save vue-qrcode-component
```

2. 31 May 2017, [vue2-filters](https://github.com/freearhey/vue2-filters) success! We can it either in the moustache syntax or in the module via `this.orderBy`, for example.
```bash
#install vue2-filters
npm install --save vue2-filters
```

3. 31 May 2017, using `mixins` in the root Vue instance, so that every Vue instance can use these methods. Check out `main.js`(line:6,line:45),`myMixin.js` and `RootMethod.vue`. 

4. 12 June 2017, using `interceptors` in vue-resource, so you can manipulate the request and response in the AJAX. Check out `main.js`, line:11 - line:20.
5.21 June 2017, [vue-echarts](https://github.com/Justineo/vue-echarts) is a good echarts component with only 7 kinds of echarts, like Bars, Pies, Maps, Radar, Polar. It seems sufficient.
6.21 June 2017, [vue-echarts-v3](https://github.com/xlsdg/vue-echarts-v3) is a wonderful component which needs further research.
7. 24 June 2017, [vue-ripple-directive](https://github.com/PygmySlowLoris/vue-ripple-directive)
8. 25 June 2017, [vue-svgicon](https://github.com/MMF-FE/vue-svgicon)
