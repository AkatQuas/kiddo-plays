import Vue from "vue";
import Router from "vue-router";
import Home from "@/views/home.vue";
import { routes } from './routes';

Vue.use(Router);

const router = new Router({
  mode: "history",
  base: process.env.BASE_URL,
  routes: [
    {
      path: "/",
      name: "home",
      component: Home
    },
    ...routes
  ]
});

router.beforeEach((to, from , next) => {
    console.log('global router before Each');
    next();
});

export default router;
