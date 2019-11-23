<template>
    <div class="page-404">
        <h1>访问的页面不存在</h1>
        <h2>Page Not Found, Error 404</h2>
        <p>You can return to
            <span class="link" @click="$router.replace('/')">home page</span>,
            or return to <span class="link" @click="$router.back()">previous page</span>
        </p>
    </div>
</template>

<style lang="scss" scoped>
    .page-404 {
        text-align: center;
        margin-top: 200px;

        .link {
            color: #66ccff;
            text-decoration: underline;
            cursor: pointer;
        }
    }
</style>

<script>
    export default {
        name: 'page-404'
    };
</script>