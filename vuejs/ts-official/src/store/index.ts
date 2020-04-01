import Vue from "vue";
import Vuex from "vuex";
import m1 from './m1';

Vue.use(Vuex);

export default new Vuex.Store({
    modules: {
        m1
    },
    state: {
        isLogin: false
    },
    getters: {
        isLogin: (state) => {
            return state.isLogin;
        }
    },
    mutations: {
        doLogin: (state, payload) => {
            // console.log(state, payload);
            state.isLogin = payload;
        }
    },
    actions: {
        lagLog: (context, payload) => {
            // console.log(context, payload);
            const { commit } = context;
            setTimeout(() => {
                commit('doLogin', payload);
            }, 1500);
        }
    }
});
