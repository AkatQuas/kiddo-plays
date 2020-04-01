<template>
    <div>
        <p>several ways to use this directive, but you have to use it globally if the whole site needs this ripple. Do checkout the <a href="https://github.com/PygmySlowLoris/vue-ripple-directive">docs</a><br>Now click these buttons.</p>

        <div>
            <span v-ripple="'rgba(99, 249, 8, 0.71)'" class="btn btn-info ">Info</span>
            <span v-ripple class="btn btn-success ">Success</span>
            <span v-ripple="'rgba(9, 249, 8, 0.71)'" class="btn btn-primary ">Medium</span>
            <span v-ripple.2000="'rgba(99, 9, 8, 0.71)'" class="btn btn-info btn-lg ">Speed Change</span>
            <span v-ripple.mouseover="'rgba(99, 9, 8, 0.71)'" class="btn btn-info btn-lg ">Large mouseover</span>
        </div>
        <p>you can customize the color with <code>v-ripple="'rgba(200, 10, 10, 0.2)'"</code>, change the transition speed with <code>v-ripple.200</code>, or even trigger it on mouseover with <code>v-ripple.mouseover</code></p>
    </div>
</template>

<script>
    export default {}
</script>

<style scoped>

</style>
