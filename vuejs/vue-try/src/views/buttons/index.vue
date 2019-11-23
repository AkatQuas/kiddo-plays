<template>
    <div>
        <p>tricky wheels on buttons, it contains 2 files: <i>BaseButton</i> & <i>TypeButton</i></p>


        <template v-for="item in buttons">
            <type-button
                    :type="item.type"
                    @click="handleClick"
                    :key="item.content"
            >{{item.content}}
            </type-button>
        </template>

        <p>For simplicity, rewrite the <i>TypeButton2</i> in a single file</p>
        <p>Extensible: just add <i>type</i>
            name in the validator function as well as add a class of the same name in the style part and there you go.
        </p>
    </div>
</template>

<style lang="scss" scoped>

</style>

<script>
    import TypeButton from './TypeButton.vue';

    export default {
        data () {
            return {
                buttons: [
                    { type: 'default', content: 'default' },
                    { type: 'plain', content: 'plain' },
                    { type: 'primary', content: 'primary' },
                    { type: 'success', content: 'success' },
                    { type: 'info', content: 'info' },
                    { type: 'warning', content: 'warning' },
                    { type: 'danger', content: 'danger' }
                ]

            };
        },
        methods: {
            handleClick () {
                console.log('clicked');
            }
        },
        components: {
            TypeButton
        }
    };
</script>
