<template>
    <div>
        <router-link to="/" tag="button" class="btn btn-primary">Back to Home</router-link><span>Test Components Lists</span>
        <hr>
        <button
                class="btn btn-info"
                v-for="component in testComponentsList"
                @click="currentView = component"
        >{{component}}</button>
        <hr>
        <component :is="currentView"></component>
    </div>
</template>

<script>
    import testQrcode from './Tests/qrcode.vue'
    import RootMethod from './Tests/RootMethod.vue'
    import RippleButtons from './Tests/RippleButtons.vue'
    import SvgIcons from './Tests/SvgIcons.vue'

    export default {
        data() {
            return {
                currentView:'test-qrcode',
                testComponentsList: [
                    'test-qrcode'
                    ,'root-method'
                    ,'ripple-buttons'
                    ,'svg-icons'
                ]
            }
        },
        components: {
            testQrcode: testQrcode
            ,rootMethod: RootMethod
            ,rippleButtons:RippleButtons
            ,svgIcons:SvgIcons
        },
        methods: {
            aow() {
                console.log(this);
                this.$root.goBackOne();
            }
        }
    }
</script>

<style scoped>
    button {
        margin-right:5px;
    }
</style>
