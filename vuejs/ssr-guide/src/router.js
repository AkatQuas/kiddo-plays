import Vue from 'vue'
import Router from 'vue-router';

Vue.use(Router)

export function createRouter () {
    return new Router({
        mode: 'history',
        routes: [
            { path: '/', component: _ => import('./components/Home.vue')},
            { path: '/foo', component: _ => import('./components/Foo.vue')},
        ]
    })
}