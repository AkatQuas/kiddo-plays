import Vue from 'vue';
import Vuex from 'vuex';

// import counter from './modules/counter';

// import * as actions from './actions';

Vue.use(Vuex);

export const store = new Vuex.Store({
    state: {
        counter: 0,
        value:0
    },
    getters: {
        doubleCounter: state => {
            return state.counter * 2;
        },
        stringCounter: state => {
            return state.counter + 'Clicks';
        },
        value: state => {
            return state.value;
        }
    },
    mutations: {
        increment: (state,payload) => {
            state.counter += payload;
        },
        decrement: (state,payload) => {
            state.counter -= payload;
        },
        updateValue: (state,payload) => {
            state.value = payload;
        }
    },
    actions: {
        increment: (context,payload) => {
            context.commit('increment',payload);
        },
        decrement: ({commit},payload) => {
            commit('decrement',payload);
        },
        asyncIncrement: ({commit},payload) => {
            setTimeout(() => {
                commit('increment',payload.by);
            },payload.duration);
        },
        asyncDecrement: ({commit},payload) => {
            setTimeout(() => {
                commit('decrement',payload.by);
            },payload.duration);
        }
    }
    /*
    ,actions

    ,modules: {
        counter
    }
    */
});
