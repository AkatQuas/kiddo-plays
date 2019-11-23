<template>
  <div id="app">
    <app-header />
    <div class="common">

    <img src="./assets/logo.png">
    <ul class="links">
      <li v-for="item in jumps" :key="item.path">
        <router-link :to="item.path"> {{ item.name }}</router-link>

      </li>
    </ul>
    </div>
    <router-view/>
  </div>
</template>

<script>
import { jumps } from "@/router/routes";
import AppHeader from "@/components/header";
export default {
  name: "App",
  components: {
    [AppHeader.name]: AppHeader
  },
  computed: {
    jumps() {
      return jumps;
    }
  }
};
</script>
<style lang="less" scoped>
.common {
  display: flex;
}
</style>


<style>
#app {
  font-family: "Avenir", Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
