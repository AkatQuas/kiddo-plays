<template>
  <div class="hello">
    <h1>{{$t('message.hello')}}</h1>
    <h1>{{ msg }}</h1>
    <h2>Essential Links</h2>
    <p>{{ $tc('message.car', 1) }}</p>
<p>{{ $tc('message.car', 2) }}</p>
    
<p>{{ $tc('message.apple', 0) }}</p>
<p>{{ $tc('message.apple', 1) }}</p>
<p>{{ $tc('message.apple', 10, { count: 10 }) }}</p>
<func-comp />
  </div>
</template>

<script>
import FuncComp from '@/components/func-comp'
export default {
  name: "HelloWorld",
  data() {
    return {
      msg: "Welcome to Your Vue.js App"
    };
  },
  components: {
    'func-comp': FuncComp
  }
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
h1,
h2 {
  font-weight: normal;
}
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}
</style>
