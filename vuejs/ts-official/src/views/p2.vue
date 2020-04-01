<template>
    <div class="about">
        <h1>This is an about computed and watch</h1>

        <button @click="makeIncrement">{{counter}} ++</button>
        <p>computed: {{ counterStrike }} </p>
        <div v-if="increment.length">
            <p>And we have <i>watch</i> values</p>
            <p v-for="(item,idx) in increment" :key="idx">new value: {{item. n}}, old value: {{item.old}} </p>
        </div>
    </div>
</template>

<script lang="ts">
    import { Vue, Watch, Component } from 'vue-property-decorator';

    @Component
    export default class DataWatchComputed extends Vue {
        counter: Number = 0;
        increment: any[] = [];

        makeIncrement() {
            this.counter++;
        }

        @Watch('counter', { immediate: false, deep: false })
        onCounterIncrement (n, old) {
            this.increment.push({ n, old });
        }

        get counterStrike () {
            return this.counter.toString()+ 'aa';
        }
    }
</script>
