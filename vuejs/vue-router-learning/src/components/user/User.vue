<template>
    <div>
        <h1>The User page</h1>
        <hr>
        <router-view></router-view>
        <hr>
        <button
                class="btn btn-default"
                @click="navigateToHome">Go to Home
        </button>
        <p>the id parameters is an instance to explain the $route</p>
        <p>Loaded ID: {{ id }}</p>
    </div>
</template>
<script>
    export default {
        created() {
            console.log(this.$route);
        },
        watch: {
            '$route'(to, from) {
                this.id = to.params.id;
            }
        },
        data() {
            return {
                id: this.$route.params.id
            }
        },
        methods: {
            navigateToHome () {
                this.$router.push({name: 'home'});
            }
        }
    }
</script>