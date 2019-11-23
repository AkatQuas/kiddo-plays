<template>
  <div @keydown.prevent="listenToKeyboard">
    <p>{{quantity}}</p>
  </div>
</template>

<script>
const DOWN_ARROW = 40;
const UP_ARROW = 38;
const ESCAPE = 27;
const MAGIC_A = 65;

export default {
  name: "Quantity",
  data: () => ({
    quantity: 0
  }),
  methods: {
    clear() {
      this.quantity = 0;
    },
    increment() {
      this.quantity += 1;
    },
    decrement() {
      this.quantity -= 1;
    },
    listenToKeyboard(e) {
      e.stopPropagation();
      switch (e.keyCode) {
        case ESCAPE:
          this.clear();
          break;
        case UP_ARROW:
          this.increment();
          break;
        case DOWN_ARROW:
          this.decrement();
          break;
        default:
          break;
      }
      if (e.key === 'a') {
        this.quantity = 13;
      }
    }
  },
};
</script>

