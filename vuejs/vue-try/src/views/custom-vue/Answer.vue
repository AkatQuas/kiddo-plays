<template>
    <div>

        <h1>This is correct!</h1>
        <hr>
        <button @click="onNextQuestion">Next Question!</button>
    </div>
</template>

<style lang="scss" scoped>

</style>

<script>
    export default {
        methods: {
            onNextQuestion () {
                this.$emit('next');
            }
        }
    };
</script>
