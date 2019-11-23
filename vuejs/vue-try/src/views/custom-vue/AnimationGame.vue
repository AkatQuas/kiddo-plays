<template>
    <div class="container">

        <div>
            <h1>The Super Quiz</h1>
        </div>
        <hr>
        <div>
            <transition mode="out-in" name="flip">
                <component
                        :is="mode"
                        @answered="answered($event)"
                        @next="mode = 'app-question'"
                ></component>
            </transition>
        </div>
    </div>
</template>

<style lang="scss" scoped>

    .container {
        max-width: 500px;
        margin: 0 auto;
        text-align: center;
    }

    .flip-enter {
        /*transform: rotateY(90deg);*/
    }

    .flip-enter-active {
        animation: flip-in .5s ease-out forwards;
    }

    .flip-leave {
        /*transform: rotateY(0deg);*/
    }

    .flip-leave-active {
        animation: flip-out .5s ease-in forwards;
    }

    @keyframes flip-out {
        from {
            transform: rotateY(0deg);
        }
        to {
            transform: rotateY(90deg);
        }
    }

    @keyframes flip-in {
        from {
            transform: rotateY(90deg);
        }
        to {
            transform: rotateY(0deg);
        }
    }
</style>

<script>
    import Question from './Question.vue';
    import Answer from './Answer.vue';

    export default {
        data () {
            return {
                mode: 'app-question'
            };
        },
        methods: {
            answered (isCorrect) {
                if ( isCorrect ) {
                    this.mode = 'app-answer';
                } else {
                    alert('Guess again');
                }
            }
        },
        components: {
            appQuestion: Question,
            appAnswer: Answer
        }
    };
</script>
