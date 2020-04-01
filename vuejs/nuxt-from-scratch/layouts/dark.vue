<template>
    <div class="dark">
        <nuxt />
    </div>
</template>

<style>
body {
    overflow: hidden;
}
.dark {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    min-height: 100%;
    background: #000;
    color: #fff;
    padding: 10px;
}
.dark a {
    color: white;
}
</style>
