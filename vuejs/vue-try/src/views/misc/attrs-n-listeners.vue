<template>
    <div>
        <h3>$attrs & $listeners</h3>
        <p>Two things are discussed in this page, <i>$attrs</i> and <i>$listeners</i>, both of which are unexpected things from parent component.
        </p>
        <p>Haven't figured everything out, save for later usage. </p>
        <div class="hello" @click.stop="ff">
            <template v-for="item in list">
                <demo :first="firstMsg + item" :second="secondMsg" :key="item"></demo>
            </template>
        </div>
    </div>
</template>

<style lang="scss" scoped>

</style>

<script>
    export default {
        data () {
            return {
                firstMsg: 'first',
                secondMsg: 'second',
                list: [1, 2, 3]
            };
        },
        methods: {
            hello () {
                alert('hello');
            },
            ff (e) {
                console.log(e.target);
            }
        },
        created () {
        },
        components: {
            Demo: {
                props: ['first'],
                render (h) {
                    return h('div', {
                        on: {
                            click: _ => {
                                console.log(this.first);
                            }
                        }
                    }, this.first);
                },
                created () {
                    console.log(this);
                },
                inheritAttrs: false
            }
        }
    };
</script>
