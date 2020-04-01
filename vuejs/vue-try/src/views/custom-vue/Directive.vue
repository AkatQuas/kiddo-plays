<template>
    <div>
        <p>read the code </p>
        <hr>
        <h1>Built-in Directive</h1>
        <p v-text="'hello'"></p>
        <p v-html="'<strong>weroajweroahwefoj</strong>'"></p>
        <hr>
        <h1>Custom Directive</h1>
        <p>directive  hello </p>
        <p>be careful, the statement in the directives should be a valid variable, string, number, etc.</p>
        <hr>
        <div>
            <p>directives have 5 hooks</p>
            <ul>
                <li v-highlight:background.delayed.hh="'red'">* bind:once directive is attached</li>
                <li>inserted: inserted in the parent node as long as the parent node exists</li>
                <li v-highlight="'blue'">* update: once component is updated, without children</li>
                <li>componentUpdated: once component is updated, with children</li>
                <li>unbind: once directive is removed</li>
            </ul>

        </div>
        <pre style="text-align: left;">
            Vue.directive('highlight',{
                bind(el,binding, vnode) {
                //  el.style.backgroundColor='green';
                //   el.style.backgroundColor=binding.value
                    if ( binding.modifiers['delayed'] ) {
                        console.log('modifier is delayed');
                    }

                    if ( binding.arg === 'background' ) {
                        el.style.backgroundColor = binding.value;
                    } else {
                        el.style.color = binding.value;
                    }
                }
            });
        </pre>
        <hr>
        <h1>local directives</h1>
        <p v-localhigh.blink="{ mC:'red',sC:'blue', interval:1500 }">local directives</p>
        <p v-localhigh="{ mC:'red',sC:'blue', interval:1500 }">local directives</p>
        <pre style="text-align: left;">
            export default {
                    ...
                directives: {
                    localhigh: {
                        bind(el,binding,vnode) {
                            if (binding.modifiers['blink']) {
                                const mainColor = binding.value.mC,
                                    secondColor = binding.value.sC,
                                    interval = binding.value.interval;
                                let currentColor = mainColor;
                                setInterval(() => {
                                    currentColor === secondColor ? currentColor = mainColor : currentColor = secondColor;
                                    el.style.color = currentColor;
                                },interval);
                            } else {
                                if ( binding.arg === 'background' ) {
                                    el.style.backgroundColor = binding.value.mC;
                                } else {
                                    el.style.color = binding.value.sC;
                                }
                            }
                        }
                    }
                }
                    ...
            }
        </pre>
        <hr>
        <button v-customOn:click="clicked">click me, custom directive</button>
        <button v-customOn:mouseenter="mouseentered">mouse enter, check console</button>

    </div>

</template>

<style lang="scss" scoped>

</style>

<script>
    export default {
        directives: {
            localhigh: {
                bind (el, binding, vnode) {
                    if ( binding.modifiers['blink'] ) {
                        const mainColor = binding.value.mC,
                            secondColor = binding.value.sC,
                            interval = binding.value.interval;
                        let currentColor = mainColor;
                        setInterval(() => {
                            currentColor === secondColor ? currentColor = mainColor : currentColor = secondColor;
                            el.style.color = currentColor;
                        }, interval);
                    } else {
                        if ( binding.arg === 'background' ) {
                            el.style.backgroundColor = binding.value.mC;
                        } else {
                            el.style.color = binding.value.sC;
                        }
                    }
                }
            },
            customOn: {
                bind (el, binding) {
//                    el.onclick = function () {
//                        binding.value();
//                    }
//
//                    or you can write like this
                    const type = binding.arg;
                    const fn = binding.value;
                    el.addEventListener(type, fn);
                }
            }
        },
        methods: {
            clicked () {
                alert('i was clicked');
            },
            mouseentered () {
                console.log('mouse enter');
            }
        }
    };
</script>
