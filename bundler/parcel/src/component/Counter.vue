<template>
    <div>
      <p>{{counter}}</p>
      <button @click="addOne">add 1 </button>
    </div>
</template>

<script>
    export default {
      props: {
        init: {
          type: Number,
          default: 0,
        }
      },
      data(props) {
        return {
          counter: this.init,
        }
      },
      methods: {
        addOne() {
          this.counter += 1;
        }
      },
    };
</script>