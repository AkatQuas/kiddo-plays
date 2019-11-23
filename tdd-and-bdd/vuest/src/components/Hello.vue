<template>
  <div>
    <template v-if="longEnough">
      <p>{{username}}</p>
    </template>
    <template v-else>
      <p class="error">not enough</p>
    </template>
  </div>
</template>

<script>
export default {
  name: 'Hello',
  data: () => ({
    username: ""
  }),
  computed: {
    longEnough() {
      return this.username.trim().length >= 7
    }
  }
};
</script>

