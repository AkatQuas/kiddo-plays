<template>
  <div>
    <ul>
      <li v-for="item in items" :key="item">{{ item }}</li>
    </ul>
    <p class="message">{{message}}</p>
  </div>
</template>

<script>
export default {
  name: "List",
  props: {
    items: {
      type: Array,
      required: true
    },
    message: {
      type: String,
      default: "default message"
    }
  }
};
</script>

