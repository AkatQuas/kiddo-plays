<template>
    <div>
        <canvas
                ref="captcha"
                :width="width"
                :height="height"
                @click.prevent="drawCap()"
        ></canvas>
    </div>
</template>

<style lang="scss" scoped>

</style>

<script>
    export default {
        name: 'captcha',
        props: {
            width: {
                default: 200
            },
            height: {
                default: 40
            },
            digit: {
                default: 4
            }
        },
        data () {
            return {
                dictionary: '1234567890abcdefghkmpqrstxyz'
            };
        },
        methods: {
            drawCap () {
                const w = this.width,
                    h = this.height,
                    num = this.digit;
                let captcha = '';
                const canvas = this.$refs.captcha;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#616161';
                ctx.fillRect(0, 0, w, h);

                const length = this.dictionary.length,
                    step = w / num,
                    fontH = 0.75 * h,
                    fontY = 0.7 * h,
                    fontW = 0.8 * step;

                for ( let i = 0; i < num; i++ ) {
                    const fontX = 10 + step * i;
                    const char = this.dictionary.substr(Math.floor(Math.random() * length), 1);
                    captcha += char;
                    const r = Math.floor(Math.random() * 75) + 180,
                        g = Math.floor(Math.random() * 75) + 180,
                        b = Math.floor(Math.random() * 75) + 180;
                    ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
                    ctx.font = fontH + 'px serif';
                    ctx.fillText(char, fontX, fontY, fontW);
                }
                this.$emit('drawn', captcha);
                setTimeout(_ => {
                    this.drawNoise(ctx);
                }, 30);
            },
            drawNoise (ctx) {
                const w = this.width,
                    h = this.height,
                    num = this.digit,
                    stars = w * h / 800,
                    lines = stars / 8;

                for ( let i = 0; i < stars; i++ ) {
                    const x = Math.floor(Math.random() * w),
                        y = Math.floor(Math.random() * h),
                        outR = Math.floor(Math.random() * 5 + 8),
                        inR = Math.floor(Math.random() * 5 + 2),
                        gon = Math.floor(Math.random() * 3 + 3),
                        r = Math.floor(Math.random() * 75 + 140),
                        g = Math.floor(Math.random() * 75 + 140),
                        b = Math.floor(Math.random() * 75 + 140);
                    const color = 'rgb(' + r + ',' + g + ',' + b + ')';
                    this.drawStars(ctx, x, y, inR, outR, gon, '', color);
                }
                for ( let i = 0; i < lines; i++ ) {
                    ctx.beginPath();
                    const s = Math.floor(Math.random() * h),
                        e = Math.floor(Math.random() * h);
                    ctx.moveTo(0, s);
                    ctx.lineTo(w, e);
                    ctx.stroke();
                }
            },
            drawStars (ctx, x, y, radius1, radius2, num, drawType, color) {
                let angle = 360 / (num * 2);
                let arr = [];
                for ( let i = 0; i < num * 2; i++ ) {
                    let starObj = {};
                    if ( i % 2 === 0 ) {
                        starObj.x = x + radius1 * Math.cos(i * angle * Math.PI / 180);
                        starObj.y = y + radius1 * Math.sin(i * angle * Math.PI / 180);
                    } else {
                        starObj.x = x + radius2 * Math.cos(i * angle * Math.PI / 180);
                        starObj.y = y + radius2 * Math.sin(i * angle * Math.PI / 180);
                    }
                    arr.push(starObj);
                }

                ctx.beginPath();
                ctx.fillStyle = color;
                ctx.strokeStyle = color;
                ctx.moveTo(arr[0].x, arr[0].y);
                for ( let i = 1; i < arr.length; i++ ) {
                    ctx.lineTo(arr[i].x, arr[i].y);
                }
                ctx.closePath();
                if ( drawType === 'fill' ) {
                    ctx.fill();
                } else {
                    ctx.stroke();
                }
            }
        },
        mounted () {
            this.drawCap();
        }
    };

</script>
