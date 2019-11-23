<template>
    <div>
        <p>A small page to display the captcha in front-end, powered by canvas.</p>
        <p>So it might as well need to verify in the front-end</p>
        <div style="margin: 0 auto;">
            <captcha @drawn="receiveCaptcha"></captcha>
        </div>
    </div>
</template>

<style lang="scss" scoped>

</style>

<script>
    import Captcha from './Captcha.vue';

    export default {
        components: {
            Captcha
        },
        data () {
            return {};
        },
        methods: {
            receiveCaptcha (captcha) {
                console.log(captcha);
            }
        }
    };
</script>
