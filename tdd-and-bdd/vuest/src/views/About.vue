<template>
  <div class="about">
    <h1>This is an about page</h1>
    <Quantity />
  </div>
</template>

<script>
import Quantity from '@/components/Quantity.vue'

export default {
  name: 'about',
  components: {
    Quantity,
  }

}
</script>

