<template>
  <div class="container" @click="clickHandle('test click', $event)">

    <div>a profile page with some user info</div>
  </div>
</template>

<script>
import card from "@/components/card";

export default {
  data() {
    return {
      motto: "Hello World",
    };
  },
  components: {
    card
  },

  methods: {
    clickHandle(msg, ev) {
      console.log("clickHandle:", msg, ev);
    }
  },

  created() {
    // 调用应用实例的方法获取全局数据
  }
};
</script>

<style scoped>

</style>
