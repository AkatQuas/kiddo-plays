<template>
    <div>
        <button @click="getContent">get content</button>
        <p> be careful with the eslint global </p>
        <tinymce ref="editor" v-model="content"></tinymce>
    </div>
</template>

<style lang="scss" scoped>

</style>

<script>
    import Tinymce from './Tinymce.vue';

    export default {
        data () {
            return {
                content:''
            };
        },
        components: { Tinymce },
        methods: {
            getContent () {
                const ctnt = this.content || 'no content';
                window.alert(ctnt);
            }
        }
    };
</script>
