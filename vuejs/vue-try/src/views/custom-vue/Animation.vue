<template>
    <div>
        <div>
            <h3>BASIC USAGE</h3>
            <p> a transition element wrapper in Vue.js</p>
            <p>you can only have one root element in the <i>transition</i>
                wrapper, or use it with <i>v-if</i> or <i>v-show</i>.</p>
            <p>if you give a <i>name</i> attribute to the transition wrapper,
                Vue.js would find the relevant class, <i>$name-enter</i>, <i>$name-enter-active</i>,
                <i>$name-leave</i>, <i>$name-leave-active</i></p>
            <div>
                <ul>
                    <li><i>$name-enter</i>: only one frame for the very
                        beginning
                    </li>
                    <li><i>$name-enter-active</i>: be careful about the css
                        attribute in this part that won't overwrite the
                        attribute in <i>$name-enter</i></li>
                    <li><i>$name-leave</i>: you may not have to write the css
                        code in this part
                    </li>
                    <li><i>$name-leave-active</i>: specify the animation you
                        want when the DOM element leaving
                    </li>
                </ul>
            </div>
            <button @click="showinfo = !showinfo">Show alert</button>
            <br><br>
            <transition name="fade">
                <div class="good-looking" v-if="showinfo">this is some info
                </div>
            </transition>
        </div>
        <hr>
        <div>
            <h3>ANOTHER CHOICE</h3>
            <p>using css animation in the <i>$name-enter-active</i> or <i>$name-leave-active</i>,
                so you only have to write to transition classes.</p>

            <p>of course you can mix these two kind of animation in the css
                code </p>
            <p>if the durations of the animation and transition are not the
                same, so you may need to tell the transition which duration is
                the time to remove the DOM element from the DOM tree. check the
                code, so you may avoid the ugly jump animation </p>
            <button @click="showinfo = !showinfo">Show slide</button>
            <br><br>
            <transition name="slide" type="transition">
                <div class="good-looking" v-if="showinfo">this is some slide
                </div>
            </transition>
        </div>
        <hr>
        <div>
            <h3>USING INITIAL ANIMATION</h3>
            <p>let the DOM element do the animation when initially mounted to
                the DOM tree, just add an attribute <i>appear</i> in the
                transition wrapper</p>
            <button @click="showinfo = !showinfo">Show slide</button>
            <br><br>
            <transition name="slide" appear>
                <div class="good-looking" v-if="showinfo">this is some slide
                </div>
            </transition>
        </div>
        <hr>
        <div>
            <h3>USING CSS LIBRARY</h3>
            <p>instead use name attribute in <i>transition</i> wrapper, we can
                specify the class name in the other attribute in
                <i>transition</i>, do keep it in mind that don't leave empty
                attribute, otherwise Vue.js will break down</p>
            <ul>
                <li><i>enter-active-class</i>: animated bounce</li>
                <li><i>leave-active-class</i>: animated shake</li>
            </ul>
            <button @click="showinfo = !showinfo">Show slide</button>
            <br><br>
            <transition
                    appear
                    enter-active-class="animated shake"
                    leave-active-class="animated bounce"
            >
                <div class="good-looking" v-if="showinfo">this is some slide
                </div>
            </transition>
        </div>
        <hr>
        <div>
            <h3>DYNAMIC NAME AND ATTRIBUTES</h3>
            <p>just using <i>:name</i> or <i>:enter-active-class</i> to
                dynamically assign the transition name, the same way we using
                other dynamic attribute</p>
        </div>
        <hr>
        <div>
            <h3>TRANSITION BETWEEN ELEMENTS</h3>
            <p>in this case you need to element in the same <i>transition</i>
                wrapper, but you have to give a key attribute to them so the Vue.js will recognize them as two different <i>div</i>.
            </p>
            <p>to have wonderful user feeling, give a <i>mode</i>
                attribute in the transition, the value could be 'out-in' or 'in-out'</p>
            <button @click="showinfo = !showinfo">Show slide</button>
            <br><br>
            <transition
                    appear
                    enter-active-class="animated shake"
                    leave-active-class="animated bounce"
                    mode="out-in"
            >
                <div class="good-looking" v-if="showinfo" key="one">this is some slide one </div>
                <div class="good-looking" v-else key="two">this is some slide two </div>
            </transition>
        </div>
        <hr>
        <div>
            <h3>TRANSITION JS HOOKS</h3>
            <p>we have 8 hooks in transition</p>
            <ul>
                <li>before-enter</li>
                <li>enter</li>
                <li>after-enter</li>
                <li>after-enter-cancelled</li>
                <li>before-leave</li>
                <li>leave</li>
                <li>after-leave</li>
                <li>after-leave-cancelled</li>
            </ul>
            <button @click="load = !load">Show load</button>
            <br><br>
            <transition
                    @before-enter="beforeEnter"
                    @enter="enter"
                    @after-enter="afterEnter"
                    @after-enter-cancelled="enterCancelled"

                    @before-leave="beforeLeave"
                    @leave="leave"
                    @after-leave="afterLeave"
                    @after-leave-cancelled="leaveCancelled"

                    :css="false"
            >
                <div class="good-looking" style="width:300px" v-if="load">transition hook</div>
            </transition>
        </div>
        <hr>
        <div>
            <h3>SWITCH BETWEEN COMPONENTS</h3>
            <button @click="selected='app-success'" v-if="selected != 'app-success'">success</button>
            <button @click="selected='app-danger'" v-else>danger</button>
            <transition
                    enter-active-class="animated shake"
                    leave-active-class="animated bounce"
                    mode="out-in"
            >
                <component :is="selected"></component>

            </transition>
        </div>
        <hr>
        <div>
            <h3>TRANSITION GROUP</h3>
            <p>One important difference: <i>transition</i> is not rendered to the DOM! <i>transition-group</i>
                does render a new HTML tag!, By default that will be a <i>span</i>
                tag, you can overwrite it by setting the attribute <i>tag="TAG"</i></p>
            <p>using <i>transition-group</i> you always need to give a <i>key</i> attribute in the iterated element</p>
            <button @click="addItem">add item</button>
            <transition-group
                    tag="div"
                    name="fade"
                    mode="out-in"

            >
                <p

                        v-for="(num,idx) in numbers"
                        @click="removeItem(idx)"
                        style="cursor: pointer"
                        :key="idx"
                        class="good-looking"
                >
                    {{num}}</p>
            </transition-group>
        </div>
    </div>
</template>

<style lang="scss" scoped>
    @import "animate.css";

    .good-looking {
        border-radius: 10px;
        padding: 10px;
        background-color: skyblue;
        color: darkblue;
    }

    .fade-enter {
        opacity: 0;
        transform: translateY(-20px);
    }

    .fade-enter-active {
        transition: all 1s;
    }

    .fade-leave {
    }

    .fade-leave-active {
        transition: all 1s;
        opacity: 0;
        transform: translateY(20px);
        position: absolute;
    }

    .fade-move {
        transition: transform 1s;
    }

    .slide-enter {
        opacity: 0;
    }

    .slide-enter-active {
        animation: slide-in 6s ease-out forwards;
        transition: opacity 3s;
    }

    .slide-leave {
    }

    .slide-leave-active {
        animation: slide-out 6s ease-in forwards;
        transition: opacity 3s;
        opacity: 0;
    }

    @keyframes slide-in {
        from {
            transform: translateY(-20px);
        }
        to {
            transform: translateY(0);
        }
    }

    @keyframes slide-out {
        from {
            transform: translateY(0);
        }
        to {
            transform: translateY(-20px);
        }
    }

</style>

<script>
    import Success from './Success.vue';
    import Danger from './Danger.vue';

    export default {
        data () {
            return {
                showinfo: true,
                load: true,
                w: 100,
                selected: 'app-success',
                numbers: [1, 2, 3, 4, 5]
            };
        },
        methods: {
            beforeEnter (el) {
                console.log('transition is before enter');
                el.style.width = '100px';
                this.w = 100;
            },
            enter (el, done) {
                console.log('transition is enter now');
                let round = 1;
                const interval = setInterval(() => {
                    if ( round >= 20 ) {
                        clearInterval(interval);
                        done();
                    }
                    el.style.width = ( this.w + round * 10 ) + 'px';
                    round++;
                }, 20);
            },
            afterEnter (el) {
                console.log('after enter');
            },
            enterCancelled () {
                console.log('enter cancelled');
            },
            beforeLeave (el) {
                console.log('before leave');
                el.style.width = '300px';
                this.w = 300;
            },
            leave (el, done) {
                console.log('leave');
                let round = 1;
                const interval = setInterval(() => {
                    if ( round >= 20 ) {
                        clearInterval(interval);
                        done();
                    }
                    el.style.width = ( this.w - round * 10 ) + 'px';
                    round++;
                }, 20);
            },
            afterLeave () {
                console.log('after leave');
            },
            leaveCancelled () {
                console.log('leave cancelled');
            },
            addItem () {
                let pos = Math.floor(Math.random() * this.numbers.length);

                this.numbers.splice(pos, 0, this.numbers.length + 1);
            },
            removeItem (idx) {
                this.numbers.splice(idx, 1);
            }
        },
        components: {
            appDanger: Danger,
            appSuccess: Success
        }
    };
</script>
