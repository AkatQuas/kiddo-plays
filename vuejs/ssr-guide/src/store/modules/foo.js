export default {
    namespaced: true,

    state : _ => ({
        count: 0
    }),
    actions: {
        inc: ({commit}) => commit('inc')
    },
    mutations: {
        inc: state => state.count++
    }
}