<template>
    <div>
        <p>Inspired by the <i>vue-popup</i> mixin which can be found <a
                href="https://github.com/ElemeFE/vue-popup" target="_blank">here</a>, mine is such a simple component for not so wild usage!
        </p>
        <button @click="showIt">open the pop window</button>
        <pop-window :visible.sync="popShow" ref="popw" :type="'double'" :on-cancel="toclose">
            <div style="position: relative">
                <div style="position: absolute;top: -80px; left: 23%">
                    <img src="../../assets/logo.png" alt="" width="40%" height="auto">
                </div>
                <p>标题</p>
                <h1>big  title</h1>
            </div>
        </pop-window>
        <p>And, using <i>directives</i>
            we can implement the save effect, but it is a good idea to rewrite the pop window component</p>
        <pop-up ref="popup1"></pop-up>
        <button v-mypop="'popup1'">directive way</button>
        <br>
        <p>try on <i>iframe</i>, it seems very good! </p>
        <iframe :src="vrUrl" frameborder="0" height="600px" width="100%"></iframe>
    </div>
</template>

<style lang="scss" scoped>

</style>

<script>
    import popWindow from './PopWindow.vue';
    import popUp from './PopUp.vue';

    export default {
        data () {
            return {
                popShow: false,
                vrUrl: ''
            };
        },
        methods: {
            showIt () {
                this.popShow = !this.popShow;
            },
            toclose () {
                console.log('f close');
            }
        },
        components: {
            popWindow,
            popUp
        },
        created () {
            this.vrUrl = 'https://cn.bing.com/';
        },
        directives: {
            mypop: {
                bind (el, binding, vnode) {
                    vnode.context.$refs[binding.value].$refs.reference = el;
                }
            }
        }
    };
</script>
