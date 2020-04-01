<template>
    <div class="header">
        <span
                v-for="nav in navs"
                :key="nav.name"
                @click="leap(nav.path)"
                :class="{active: $route.name === nav.name}"
        >{{nav.name}}</span>
    </div>
</template>

<style lang="scss" scoped>
    .header {
        text-align: center;

        span {
            padding: 5px 10px;
            margin: 5px 10px;
            display: inline-block;
            width: 16%;
            background-color: #419ce2;
            border-radius: 5px;
            line-height: 40px;
            color: #ffffff;
            font-weight: 600;

            &.active {
                background-color: #ff3adb;
            }
        }
    }
</style>

<script>
    export default {
        name: 'header',
        methods: {
            leap (route) {
                this.$router.push(route);
            }
        },
        computed: {
            navs () {
                return this.$store.getters.navroutes;
            }
        }
    };
</script>
