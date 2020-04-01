Just  `npm run dev`, and find the codes.
# vuetry

> A Vue.js project while trying something interesting and amazing, sometimes making wheels.

* 28/07/2017, found [vuejs-paginate](https://github.com/lokyoung/vuejs-paginate)
* 08/09/2017, found [coordinate-convert](https://github.com/stuarqi/coordinate-convert)
* 21/09/2017, self-made data Table with pagination, auto-loading the data from the server, [check the code](src/views/data-table).
* 22/09/2017, found [nprogress](https://github.com/rstacruz/nprogress), which is kind of tricky because this plugin can't be customized so I rewrite the style file which is saved in `src/assets/style/nprogress.scss`. In general, it is an amazing plugin to use. I recommend using it in ajax request since router switch already got its animation, no need for extra UX. However in this project, it has little ajax request, I use `nprogress` in router switching to enjoy the amazing feeling. However, `nprogress` does not have `fail` function, which means the progress bar won't turn to failure status even if the router or ajax fail. That is not a good UX.
* 22/09/2017, found [vue-snotify](https://github.com/artemsky/vue-snotify). A powerful notification plugin with many types, such as `success`, `error`, `alert`, `confirm`, `async`, etc. While, [vs-notify](https://github.com/NxtChg/pieces/tree/master/js/vue/vs-notify) is another powerful notification notifier. They have different features, choose it for yourself!
* 13/10/2017, found [vue-router-storage](https://github.com/ElderJames/vue-router-storage), Check the document, a vue router storage solution.
* 26/10/2017, experiment on `render` function, kind of awesome result, [check the code](src/views/misc/render-func.vue).
* ADD buttons wheels, easily to customize the `color` or the `type`, [check the code](src/views/buttons) 
* Figuring out `$attrs` and `$listeners` on child component,[check the code](src/views/misc/attrs-n-listeners.vue)

## Build Setup

``` bash
# install dependencies
npm install

# serve with hot reload at localhost:8080
npm run dev

# build for production with minification
npm run build

# build for production and view the bundle analyzer report
npm run build --report
``` 

