export default {
    namespaced: true,
    state: {
        counter: 0
    },
    getters: {
        counter: state => state.counter
    },
    mutations: {
        op: (state, payload: any) => {
            const { counter } = state
            state.counter = counter + payload;
        }
    },
    actions: {
        lagOp: ({ commit }, payload) => {
            // const { commit } = context;
            setTimeout(() => {
                commit('op', payload);
            }, 1500);
        }
    }
}
