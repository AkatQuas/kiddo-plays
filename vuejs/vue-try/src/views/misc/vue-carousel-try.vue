<template>
    <div class="text-center">
        <p>Dependencies: <i>Vue-Carousel</i>, document is <a href="https://ssense.github.io/vue-carousel/api/">here</a>, supporting <i>autoplay, loop</i>.
        </p>
        <hr>
        <carousel
                autoplay loop
                paginationEnabled
                paginationActiveColor="#66ccff"
                paginationColor="#ffcc66"
                :perPage="1"
        >
            <slide>
                <img
                        src="http://p2dctyxhs.bkt.clouddn.com/xmpoker_screen_1.png"
                        alt=""
                        class="img img-responsive img-thumbnail img-rounded"
                >
            </slide>
            <slide>
                <img
                        src="http://p2dctyxhs.bkt.clouddn.com/xmpoker_screen_1.png"
                        alt=""
                        class="img img-responsive img-thumbnail img-rounded"
                >
            </slide>
        </carousel>
    </div>
</template>

<style lang="scss" scoped>
    .img {
        width: 600px;
    }
</style>

<script>
    import { Carousel, Slide } from 'vue-carousel';

    export default {
        components: { Carousel, Slide },
        data () {
            return {};
        },
        methods: {},
        created () {
        }
    };
</script>

