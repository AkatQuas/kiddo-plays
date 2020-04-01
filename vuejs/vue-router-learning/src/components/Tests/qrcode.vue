<template>
    <div>
        <p>generating QR code in vue, "dependencies" is "vue-qrcode-component"</p>
        <app-qrcode
                :text="site"
                size="200"
                color="#000"
                bg-color="#fff"
                error-level="L"
        ></app-qrcode>
    </div>
</template>

<script>
    import VueQRCodeComponent from 'vue-qrcode-component'
    export default {
        data() {
            return {
                site: ''
            }
        },
        components:{
            appQrcode: VueQRCodeComponent
        },
        methods: {

        },
        mounted() {
            let vm = this;
            setTimeout(function () {
                console.log(vm.site);
                vm.site = 'http://www.baidu.com/';
                console.log(vm.site);
            },500);
        }
    }
</script>

<style scoped>

</style>
