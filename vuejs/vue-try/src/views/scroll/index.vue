<template>
    <div>
        <div>
            <div class="list" ref="wrapper" @scroll="scroll">
                <ul ref="ul">
                    <li
                            v-for="idx in list"
                            :key="idx"
                    >{{idx}} item
                    </li>
                </ul>
            </div>
            <div style="display: inline-block;width: 30%;">
                <p>Scroll the list-view, check the data</p>
                <p v-for="item in datas" :key="item.label">
                    <i>{{item.label}}: </i> {{item.val}}
                </p>
            </div>
        </div>
        <h3>How Scroll Works?</h3>
        <p>check the image</p>

        <img src="./scroll.png" alt="" style="border-radius: 6px; padding: 3px; border: 1px solid #ccc;">
        <p>
            the height of the wrapper is fixed, so the view window is limited. And set the wrapper <i>overflow-y: scroll</i>.
        </p>
        <p>Then it comes the <i>clientHeight</i> of the wrapper and list, so you can do your calculation.</p>
    </div>
</template>

<style lang="scss" scoped>
    .list {
        display: inline-block;
        width: 50%;
        margin: 0 auto;
        height: 300px;
        overflow-y: scroll;
        border: 1px solid #ccc;
        padding: 10px;

        ul {
            width: 100%;
            height: auto;
            list-style: none;
        }
    }

    ul {
        width: 50%;
        margin: 0 auto;
        height: auto;
        overflow: hidden;
    }
</style>

<script>
    export default {
        components: {},
        data() {
            return {
                list: 25,
                wst: 0,
                wch: 0,
                uch: 0
            };
        },
        computed: {
            datas() {
                return [
                    { label: 'wrapper.scrollTop', val: this.wst },
                    { label: 'wrapper.clientHeight', val: this.wch },
                    { label: 'content.clientHeight', val: this.uch }
                ];
            }
        },
        methods: {
            scroll( e ) {
                const vm = this;
                vm.wst = vm.$refs.wrapper.scrollTop;
                vm.wch = vm.$refs.wrapper.clientHeight;
                vm.uch = vm.$refs.ul.clientHeight;
            }

        },
        created() {
        },
        mounted() {
        }
    };
</script>

