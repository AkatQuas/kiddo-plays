import Vue from 'vue';
import Vuex from 'vuex';

import navroutes from './modules/navroutes';

Vue.use(Vuex);

const store = new Vuex.Store({
    modules: {
        navroutes
    }
});
export default store;
