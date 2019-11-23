import Vue from 'vue';
import VueResource from 'vue-resource';
import VueRouter from 'vue-router';
import App from './App.vue';

import { store } from './store/store.js';


Vue.use(VueRouter);
Vue.use(VueResource);


new Vue({
    el: '#app',
    store,
    render: h => h(App),

});
