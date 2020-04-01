<template>
    <div>
        <p>here using mixin to register some methods in the root Vue instance so we can use them in the components.</p>
        <span
                class="btn btn-info col-xs-pull-1"
                @click="C_commit(button.method)"
                v-for="button in buttons"
        >{{ button.name }}</span>
    </div>
</template>

<script>
    export default {
        data() {
            return {
                buttons:[
                    {name:'method one',method:'one'}
                    ,{name:'method two',method:'two'}
                ]
            }
        },
        methods: {
            C_commit(type) {
                switch (type) {
                    case 'one' :
                        this.$root.methodOne();
                        break;
                    case 'two':
                        this.$root.methodTwo();
                        break;
                }

            }
        }
    }
</script>

<style scoped>

</style>
