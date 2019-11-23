import Vue from 'vue';
import VueRouter from 'vue-router';
import routes from './routes';

Vue.use(VueRouter);

const router = new VueRouter({
    routes,
    mode: 'history',
    base: ''
});

router.beforeEach((to, from, next) => {
    next();
});

export default router;