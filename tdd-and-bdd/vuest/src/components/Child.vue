<template>
  <div>
    <input v-model="name" />
    <span>{{name}}</span>
  </div>
</template>

<script>
export default {
  name: 'ChildComponent',
  data: () => ({
    name: '',
  }),
  created() {
    setTimeout(() => {
      this.$emit('custom');
    }, 1000);
  }
}
</script>

