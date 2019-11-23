<template>
  <div class="home">
    <Parent />
    <Hello />
    <img alt="Vue logo" src="../assets/logo.png">
    <HelloWorld msg="Welcome to Your Vue.js App"/>
  </div>
</template>

<script>
// @ is an alias to /src
import HelloWorld from '@/components/HelloWorld.vue'
import Hello from '@/components/Hello.vue'
import Parent from '@/components/Parent.vue'

export default {
  name: 'home',
  components: {
    Parent,
    Hello,
    HelloWorld
  }
}
</script>
