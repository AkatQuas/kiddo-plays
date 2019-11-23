<template>
    <div>
      <nuxt-link v-if="page > 1" :to="'?page=' + (page - 1)">&lt; Prev</nuxt-link>
        <h1>Users main file</h1>
        <tip tip="a tip from users" />
        <p>Warning: don't forget to write &lt;nuxt-child/&gt; inside the parent component (.vue file).</p>
        <nuxt-child />
    </div>
</template>

<script>
import Tip from "~/components/tip";
console.log(Tip.name);
export default {
  // Watch for $route.query.page to call Component methods (asyncData, fetch, validate, layout, etc.)
  watchQuery: ['page'],
  // Key for <nuxt-child> (transitions)
  key: to => to.fullPath,
  // Called to know which transition to apply
  transition(to, from) {
    if (!from) return 'slide-left'
    return +to.query.page < +from.query.page ? 'slide-right' : 'slide-left'
  },
  asyncData({ query }) {
    const page = +query.page || 1;
    
    return new Promise(resolve => {
      setTimeout(function() {
        resolve({ name: "world" , page });
      }, 1000);
    });
  },
  components: {
    [Tip.name]: Tip
  }
};
</script>

