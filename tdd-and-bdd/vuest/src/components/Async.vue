<template>
  <div>
    <button class="user" @click="getUser">get user</button>
  </div>
</template>

<script>
import { getUser } from "@/http";
export default {
  data: () => ({
    user: null
  }),
  methods: {
    getUser() {
      getUser("xx").then(res => (this.user = res));
    }
  }
};
</script>

