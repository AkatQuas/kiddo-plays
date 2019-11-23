<template>
  <div>
    <button class="yes" @click="callYes"> Yes </button>
    <button class="no" @click="callNo"> No </button>
  </div>
</template>

<script>
export default {
  name: 'YesNo',
  props: {
    callMe: {
      type: Function,
      required: true,
    },
  },
  methods: {
    callYes() {
      this.callMe('yes');
    },
    callNo() {
      this.callMe('no');
    }
  }
}
</script>

