<template>
    <div id="app">
      <counter ></counter>
      <br />
      <counter :init="2" ></counter>
    </div>
</template>

<script>
    import Counter from './component/counter.vue';
    export default {
        name: 'app',
        components: {
            Counter
        }
    };
</script>

<style lang="scss">
    #app {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        color: #000000;
        margin-top: 60px;
    }
    button {
        font-weight: bold;
        background-color: #eee;
        padding: 4px 8px;
        border-radius: 4px;
    }
</style>