<template>
    <div class="hello">
        <p>This is a hello page just for beginning.</p>
        <p>{{ msg }}</p>
        <p @click="tryfunc()">function test</p>
        <img src="../assets/logo.png">
    </div>
</template>

<script>
    export default {
        name: 'hello',
        data () {
            return {
                msg: 'Welcome to Your Vue.js App'
            };
        },
        methods: {
            tryfunc (vm = this) {
                console.log(vm);
            }
        },
        created () {
            console.log(this.$history);
        }
    };
</script>
<style scoped>
    .hello {
        text-align: center;
    }
</style>
