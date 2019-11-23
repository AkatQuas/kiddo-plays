<template>
    <div>
        <!--
        <p>Counter is: {{ counter }}</p>
        <p>Number of Clicks: {{ clicks }}</p>
        -->
        <p>Counter is: {{ doubleCounter }}</p>
        <p>Number of Clicks: {{ stringCounter }}</p>
        <p>{{ ourOwn }}, here is our own property</p>
    </div>
</template>

<script>
    import {mapGetters} from 'vuex';
    export default {
//        computed: {
//            counter() {
//                return this.$store.getters.doubleCounter;
//            },
//            clicks() {
//                return this.$store.getters.stringCounter;
//            }
//        }


//        computed: mapGetters([
//            'doubleCounter',
//            'stringCounter'
//        ])

        computed: {
            ...mapGetters([
                'doubleCounter',
                'stringCounter'
            ]),
            ourOwn() {
                return 'own property';
            }
        }
    }
</script>

<style>

</style>
