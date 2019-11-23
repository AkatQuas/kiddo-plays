<template>
<div>
    <h1>Hello {{ title }} nuxt</h1>
  <img src="~/assets/image.png" />
  <img src="/cute.jpg" alt="">
  <br />
  <nuxt-link to="/users">Go to users </nuxt-link>
  <nuxt-link to="/about">Go to About </nuxt-link>

</div>

</template>

<script>
import axios from 'axios';
export default {
  asyncData({ params, error }) {
    return axios
      .get(`https://httpbin.org/get?id=${params.id}`)
      .then(res => {
        return { title: res.data.origin };
      })
      .catch(e => {
        error({ statusCode: 404, message: "Post not found" });
      });
  }
  /*
  // using async/await
  async asyncData({ params }) {
    let { data } = await axios.get(`https://httpbin.org/get?id=${params.id}`);
    return { title: data.title };
  },
  // using callback
  asyncData({ params }, callback) {
    axios.get(`https://httpbin.org/get?id=${params.id}`).then(res => {
      callback(null, { title: res.data.title });
    })
    .catch(e => {
        callback({ statusCode: 404, message: 'Post not found' })
    });
  }
  */
};
</script>
