<template>
    <h1 class="red">Hello {{ name }}</h1>
</template>

<script>
export default {
  asyncData(context) {
    return { name: "World!!!" };
  },
  fetch () {

  },
  head () {
    return {
      meta: [
        { name: 'description', content: 'Hello Page'}
      ]
    }
  },

};
</script>

<style>
.red {
    color: red;
}
</style>

