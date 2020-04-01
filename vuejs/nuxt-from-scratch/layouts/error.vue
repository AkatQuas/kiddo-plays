<template>
    <div class="container">
        <h1 v-if="error.statusCode === 404">Page not Found</h1>
        <h1 v-else>An Error Occured</h1>
        <nuxt-link to="/">Home Page</nuxt-link>
    </div>
</template>

<script>
export default {
    props: {
        error: {
            type: Object,
            default: null
        }
    }, 
    layout: 'blog'
}
</script>

<style scoped>
.container  {
    font-family: sans-serif;
    padding-top: 10%;
    text-align: center;
}
h1 {
    font-size: 20px;
}
</style>
