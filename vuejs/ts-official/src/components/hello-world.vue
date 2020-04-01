<template>
    <div class="hello">
        <h1 @click="greet" style="cursor: pointer">click me: {{ msg }}</h1>
        <h1>default props: {{ defaultMsg }}</h1>
        <h1>{{ typeProps }}</h1>
        <input type="text" v-model="text1">

    </div>
</template>

<script lang="ts">
    import { Component, Prop, Vue, Watch } from "vue-property-decorator";

    @Component
    export default class HelloWorld extends Vue {
        @Prop(String)
        private msg!: string;

        @Prop({ default: 'default message' })
        private defaultMsg: string;

        @Prop({ type: [Boolean, String] })
        private typeProps!;

        text1: string = 'two-way binding here';

        mounted () {
            console.log(this);
            console.log('hello mounted');
        }

        greet () {
            console.log(this);
            alert('hello greet:' + this.msg);
        }

        @Watch('text1')
        randomNameForTheWatchMethod (n, o) {
            console.log('watch new', n);
        }
    }
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="less">
    h3 {
        margin: 40px 0 0;
    }

    ul {
        list-style-type: none;
        padding: 0;
    }

    li {
        display: inline-block;
        margin: 0 10px;
    }

    a {
        color: #42b983;
    }
</style>
