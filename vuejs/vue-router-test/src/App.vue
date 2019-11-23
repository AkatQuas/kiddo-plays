<template>
    <div class="row">
        <div class="col-xs-10 col-xs-offset-1 col-sm-8 col-sm-offset-2 col-md-6 col-offset-3">
            <app-header></app-header>
            <hr>
            <router-view></router-view>
        </div>
    </div>
</template>

<script>
    import Header from './components/Header.vue'

    export default {
        components : {
            appHeader: Header
        }
    }
</script>

<style>

</style>
