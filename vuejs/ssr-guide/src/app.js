import Vue from 'vue';
import App from './App.vue';
import { createRouter } from './router'
import { createStore } from './store';
import { sync } from 'vuex-router-sync';


export function createApp() {
    const router = createRouter()
    const store = createStore()

    // sync the route state to the store
    sync(store, router)
    const app = new Vue({
        store,
        router,
        render: h => h(App)
    })

    return { app, router, store }
}