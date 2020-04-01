<template>
    <div>
        <div>vuex test</div>
        <p>status: {{loginStatus}}</p>
        <p>Getters: {{getterStatus}}</p>
        <button @click="login">login</button>
        <button @click="logout">logout</button>
        <button @click="lagLogin">lag login</button>
        <button @click="lagLogout">lag logout</button>
        <hr>
        <p>module getters: {{ m1Counter }} , using <a href="https://github.com/ktsn/vuex-class">vuex class</a> syntax sugar,<br>so the <i>mapGetters, mapMutations</i> is not suitable is typescript. <a href="https://github.com/AkatQuas/vue-playlist/tree/master/vuex-learning/src/components">which</a> can do better in javascript-based project.

        </p>
        <button @click="m1Op1">op +1</button>
        <button @click="m1Op0">op -1</button>
        <button @click="m1LagOp1">op lag +1</button>
        <button @click="m1LagOp0">op lag -1</button>
        <hr>
        <p>Binding root store with vuex-class.</p>
        <p>root Store: {{ rootIsLogin}}</p>
        <button @click="rootLogin">root login</button>
        <button @click="rootLogout">root logout</button>
        <button @click="rootLagLogin">root login</button>
        <button @click="rootLagLogout">root logout</button>
    </div>


</template>

<script lang="ts">
    import { Getter, namespace, Mutation, Action } from 'vuex-class';
    import { Component, Vue } from 'vue-property-decorator';
    const m1Module = namespace('m1');

    @Component()
    export default class VuexPage extends Vue {
        created () {
            console.log(this.$store.state.isLogin);
        }

        login () {
            this.$store.commit('doLogin', true);
        }

        logout () {
            this.$store.commit('doLogin', false);
        }

        lagLogin() {
            this.$store.dispatch('lagLog', true);
        }
        lagLogout() {
            this.$store.dispatch('lagLog', false);
        }
        get loginStatus () {
            const { isLogin } = this.$store.state;
            return isLogin ? 'logged' : 'visitor';
        }
        get getterStatus () {
            return this.$store.getters.isLogin;
        }

        @Getter('isLogin') rootIsLogin;
        @Mutation('doLogin') rootDoLogin;
        @Action('lagLog') rootLagLog;

        rootLogin() {
            this.rootDoLogin(true);
        }
        rootLogout() {
            this.rootDoLogin(false);
        }
        rootLagLogin() {
            this.rootLagLog(true);
        }
        rootLagLogout() {
            this.rootLagLog(false);
        }

        @m1Module.Getter('counter') m1Counter;
        @m1Module.Mutation('op') m1Op;
        @m1Module.Action('lagOp') m1LagOp;

        m1Op1() {
            this.m1Op(1);
        }
        m1Op0(){
            this.m1Op(-1);
        }
        m1LagOp1 (){
            this.m1LagOp(1);
        }
        m1LagOp0 (){
            this.m1LagOp(-1);
        }
    }
</script>

<style lang="less" scoped>
</style>
