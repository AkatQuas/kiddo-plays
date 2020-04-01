<template>
    <div class="window" v-if="visible">
        <div class="overlay" @click.stop="overlayClick"></div>

        <div class="content">
            <div class="main">
                <slot>
                    <p>默认的语句</p>
                </slot>
            </div>

            <div class="bottom">
                <div class="bottom-1-item main-color" @click.stop="closeWindow"
                     v-if="type === 'single'">
                    <span>{{oneTip}}</span>
                </div>
                <slot name="buttons" v-if="type === 'double'">
                    <div class="bottom-2-item" @click.stop="cancelClick">
                        <span>{{cancelText}}</span>
                    </div>
                    <div class="bottom-2-item" @click.stop="confirmClick">
                        <span class="main-color">{{confirmText}}</span>
                    </div>

                </slot>

            </div>
        </div>

    </div>
</template>

<style lang="scss" scoped>
    .window {
        top: 0;
        bottom: 0;
        right: 0;
        left: 0;
        text-align: center;
        position: absolute;
        z-index: 1024;

        .overlay {
            width: 100%;
            height: 100%;
            background-color: rgba(1, 1, 1, 0.45);
        }
        .content {
            width: 85%;
            max-width: 400px;
            background-color: white;
            margin: 200px auto;
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            border-radius: 5px;
            z-index: 2048;

            .main {
                padding: 10px 15px 20px;
                min-height: 100px;
            }

            .bottom {
                border-top: 1px solid #000000;
                /*todo change the color*/
                display: flex;

                .bottom-1-item {
                    width: 100%;
                    padding: 10px 0;
                }

                .bottom-2-item {
                    width: 50%;
                    padding: 10px 0;
                    border-right: 1px solid #000000;

                    &:last-of-type {
                        border-right-color: transparent;
                    }

                }
            }
        }
    }


</style>

<script>
    export default {
        name: 'pop-window',
        props: {
            type: {
                type: String,
                default: 'single',
                validator: v => ['single', 'double'].indexOf(v) > -1
            },
            visible: {
                type: Boolean,
                default: false
            },
            oneTip: {
                type: String,
                default: '关闭'
            },
            cancelText: {
                type: String,
                default: '取消'
            },
            confirmText: {
                type: String,
                default: '确定'
            },
            overlayClose: {
                type: Boolean,
                default: true
            },
            onCancel: {
                type: Function,
                default: _ => false
            },
            onConfirm: {
                type: Function,
                default: _ => false
            }
        },
        data () {
            return {};
        },
        methods: {
            closeWindow () {
                this.$emit('update:visible', false);
            },
            overlayClick () {
                if ( this.overlayClose ) {
                    this.closeWindow();
                } else {
                    return false;
                }
            },
            cancelClick () {
                this.onCancel();
                this.closeWindow();
            },
            confirmClick () {
                this.onConfirm();
                this.closeWindow();
            }
        }
    };
</script>
