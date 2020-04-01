<template>
    <div id="app">
        <app-header></app-header>
        <router-view></router-view>
    </div>
</template>

<script>
    import Header from './components/modules/Header.vue';

    export default {
        name: 'app',
        components: {
            appHeader: Header
        }
    };
</script>

<style lang="scss">
    @import "style/normalize.css";
    #app {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        color: #000000;
        margin-top: 60px;
    }
    i {
        font-weight: bold;
        background-color: #eee;
        padding: 4px 8px;
        border-radius: 4px;
    }
</style>
