import Vue from 'vue';
import VueResource from 'vue-resource';
import VueRouter from 'vue-router';
import Ripple from 'vue-ripple-directive';
import App from './App.vue';
import {routes} from './routes';
import { myMixins } from './myMixins';

Vue.use(VueRouter);
Vue.use(VueResource);
Vue.directive('ripple',Ripple);

Vue.http.interceptors.push((request, next) => {
    //do something on the request
    console.log(request);

    //call next() and do something about the response, checkout the vue-router gitbook.
    next((response) => {
        return response
    });

});

const router = new VueRouter({
    routes,
    mode: 'history',
    scrollBehavior(to, from, savedPosition) {
        if (savedPosition) {
            return savedPosition;
        }
        if (to.hash) {
            return {selector: to.hash};
        }
        return {x: 0, y: 0};
    }
});

router.beforeEach((to, from, next) => {
    console.log('global beforeEach');
    next();
});

new Vue({
    el: '#app',
    router,
    render: h => h(App),
    mixins:[myMixins]
});
