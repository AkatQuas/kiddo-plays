import stocks from '../../data/stocks';
const state = {
    stocks: []
};

const mutations = {
    'SET_STOCKS' (state,stocks) {
        state.stocks=stocks;
    },
    'RND_STOCKS' (state) {
        state.stocks.map(element => {
            element.price += Math.floor(Math.random() * 40 - 20);
        });
    }
};

const actions ={
    buyStock: (context,order) => {
        context.commit('BUY_STOCKS',order);
    },
    initStocks: ({commit}) => {
        commit('SET_STOCKS',stocks);
    },
    randomizeStocks: ({commit}) => {
        commit('RND_STOCKS');
    }
};

const getters = {
  stocks: state => {
      return state.stocks;
  }
};

export default {
    state,
    mutations,
    actions,
    getters
}