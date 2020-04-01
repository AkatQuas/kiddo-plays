<template>
    <div class="about">
        <h1>This is an router hooks page</h1>
        <p>register some hooks before using <i>Component</i> as the decorator.</p>
    </div>
</template>

<script>
    import { Component, Vue } from 'vue-property-decorator';
    Component.registerHooks([
        'beforeRouteEnter',
        'beforeRouteLeave',
        'beforeRouteUpdate'
    ]);

    @Component()
    export default class RouterHooks extends Vue {
        beforeRouteEnter (to, from, next) {
            console.log('component beforeRouteEnter');
            next(); // needs to be called to confirm the navigation
        }

        beforeRouteLeave (to, from, next) {
            console.log('component beforeRouteLeave');
            next(); // needs to be called to confirm the navigation
        }
    }
</script>