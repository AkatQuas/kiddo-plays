<template>
  <div>
    <span class="count">{{count}}</span>
    <button @click="increment">Increment</button>
  </div>
</template>

<script>
export default {
  name: 'Counter',
  data: () => ({
    count: 0,
  }),
  methods: {
    increment() {
      this.count += 1;
    }
  }
}
</script>

