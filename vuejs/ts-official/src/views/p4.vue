<template>
    <div>
        <div>3rd lib: iakit test</div>
        <button @click="alert">alert</button>
        <button @click="toast">toast</button>
    </div>
</template>
<script lang="ts">
    import { Component, Vue } from 'vue-property-decorator';
    import * as iakit from 'iakit';

    @Component()
    export default class IakitPage extends Vue {
        alert() {
            iakit.alert('i am alerting');
        }
        toast() {
            iakit.toast.showTop('hhhhh');
        }
    }
</script>

<style lang="less" scoped>
</style>
