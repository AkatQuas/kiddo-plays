<template>
    <div>
        <h3> {{question}}</h3>
        <div>
            <p>
                <button
                        v-for="btn in btns"
                        @click="onAnswer(btn.correct)"
                        class="answer-btn"
                        :key="btn.answer"
                >
                    {{btn.answer}}
                </button>
            </p>
        </div>

    </div>
</template>

<style lang="scss" scoped>
    .answer-btn {
        padding: 10px 15px;
        border-radius: 6px;
        background-color: darkseagreen;
        color: #ffffff;
    }

</style>

<script>
    const [MODE_ADDTION, MODE_SUBTRACTION] = [1, 2];
    export default {
        data () {
            return {
                question: 'Oops, an error occurred!',
                btns: [
                    { correct: false, answer: 0 },
                    { correct: false, answer: 0 },
                    { correct: false, answer: 0 },
                    { correct: true, answer: 0 }
                ]
            };
        },
        methods: {
            generateQuestion () {
                const firstNumber = this.generateRandomNumber(1, 100),
                    secondNumber = this.generateRandomNumber(1, 100),
                    mode = this.generateRandomNumber(1, 2);
                let correctAnswer = 0;
                switch ( mode ) {
                    case MODE_ADDTION :
                        correctAnswer = firstNumber + secondNumber;
                        this.question = `What is ${firstNumber} + ${secondNumber} ?`;
                        break;
                    case MODE_SUBTRACTION:
                        correctAnswer = firstNumber - secondNumber;
                        this.question = `What is ${firstNumber} - ${secondNumber} ?`;
                        break;
                    default:
                        this.question = 'Oops, an error occurred!';
                }
                this.btns = this.btns.map(v => {
                    v.correct = false;
                    v.answer = this.generateRandomNumber(correctAnswer - 10, correctAnswer + 10, correctAnswer);
                    return v;
                });
                const correctButton = this.generateRandomNumber(0, 3);
                this.btns[correctButton].correct = true;
                this.btns[correctButton].answer = correctAnswer;
            },
            generateRandomNumber (min, max, except) {
                const rndNumber = Math.round(Math.random() * (max - min)) + min;
                if ( rndNumber === except ) {
                    return this.generateRandomNumber(min, max, except);
                }
                return rndNumber;
            },

            onAnswer (isCorrect) {
                this.$emit('answered', isCorrect);
            }
        },
        created () {
            this.generateQuestion();
        }
    };
</script>
