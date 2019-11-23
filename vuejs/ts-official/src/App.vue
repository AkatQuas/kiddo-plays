<template>
    <div id="app">
        <div id="nav">
            <router-link to="/" exact>Home</router-link>
            <template v-for="item in navs">| <router-link :to="item.path" :key="item.path">{{item.name}}</router-link></template>
        </div>
        <router-view/>
    </div>
</template>

<script lang="ts">
    import { Component, Vue } from 'vue-property-decorator';
    import { routes } from '@/router/routes';

    @Component()
    export default class App extends Vue {
        navs = routes.filter(item => item.name).map(({ name, path }) => ({ name, path }));
    }
</script>
<style lang="less">
    @import "~iakit/dist/style.css";
    #app {
        font-family: "Avenir", Helvetica, Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-align: center;
        color: #2c3e50;
    }

    #nav {
        padding: 30px;
        a {
            font-weight: bold;
            color: #2c3e50;
            &.router-link-exact-active {
                color: #42b983;
            }
        }
    }
</style>
