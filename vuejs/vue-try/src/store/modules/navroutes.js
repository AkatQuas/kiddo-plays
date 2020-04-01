import routes from '../../router/routes';

const filtered = routes.filter(v => !(v.path === '*'));

const state = {
    navroutes: filtered
};

const getters = {
    navroutes: state => state.navroutes
};

export default {
    state,
    getters
};