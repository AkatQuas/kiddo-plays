/*
import Vuex  from 'vuex';

const createStore = _ => {
    return new Vuex.Store({
        // strict: false,
        state: {
            counter: 0
        },
        mutations: {
            increment (state) {
                state.counter++
            }
        }
    })
}
export default createStore;
*/

export const state = _ => ({
    locales: ['en', 'cn'],
    locale: 'en',
    counter: 0
})

export const mutations = {
    SET_LANG(state, locale) {
        if (state.locales.indexOf(locale) > -1) {
            state.locale = locale
        }
    },
    increment (state) {
        state.counter++
    }
}