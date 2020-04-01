<template>
  <div>
    <div class="message">{{message}}</div>
    <template v-if="longEnough">
      <p class="username">{{username}}</p>
    </template>
    <template v-else>
      <p class="error">not long enough</p>
    </template>
  </div>
</template>

<script>
export default {
  name: "Fooa",
  data: () => ({
    message: "abc",
    username: ""
  }),
  computed: {
    longEnough() {
      return this.username.trim().length >= 7;
    }
  }
};
</script>

