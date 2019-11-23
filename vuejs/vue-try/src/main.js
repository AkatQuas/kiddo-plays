import Vue from 'vue';
import App from './App.vue';
import axios from './config/axios';
import VueAxios from 'vue-axios';
import router from './router';
import store from './store';

Vue.use(VueAxios, axios);

Vue.config.productionTip = false;

Vue.directive('highlight', {
    bind (el, binding, vnode) {
        //  el.style.backgroundColor='green';
        //   el.style.backgroundColor=binding.value
        if ( binding.modifiers['delayed'] ) {
            console.log('modifier is delayed');
            console.log(binding.modifiers);
        }
        console.log(el, binding, vnode);
        if ( binding.arg === 'background' ) {
            el.style.backgroundColor = binding.value;
        } else {
            el.style.color = binding.value;
        }
    }
});
/* eslint-disable no-new */
new Vue({
    el: '#app',
    store,
    router,
    template: '<App/>',
    components: { App }
});
