<script>
    export default {
        name: 'base-button',
        props: [],

        render (createElement) {
            return createElement(
                'a',
                {
                    class: ['button', 'ripple'],
                    on: {
                        click: this.click
                    }
                },
                this.$slots.default
            );
        },
        methods: {
            click () {
                this.$emit('click');
            }
        }
    };
</script>
<style lang="scss" scoped>
    $primaryBg: #009688;
    $successBg: #4caf50;
    $infoBg: #03a9f4;
    $warningBg: #ff5722;
    $dangerBg: #f44336;

    a.button {
        $typeColor: rgba(255, 255, 255, 0.84);

        display: inline-block;
        line-height: 1.2;
        text-align: center;
        white-space: nowrap;
        cursor: pointer;
        user-select: none;
        border: none;
        border-radius: 2px;
        position: relative;
        padding: 6px 10px;
        margin: 5px 1px;
        font-size: 14px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0;
        will-change: box-shadow, transform;
        transition: box-shadow 0.2s cubic-bezier(0.4, 0, 1, 1), background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        text-decoration: none;
        background: transparent;
        color: rgba(0, 0, 0, 0.87);

        &:active {
            box-shadow: 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
        }

        &.default {
            background-color: #eeeeee;
            color: rgba(0, 0, 0, 0.87);
        }

        &.plain {
            background-color: transparent;
            color: rgba(0, 0, 0, 0.87);

            &:hover {
                cursor: pointer;
                text-decoration: underline;
            }
        }

        &.primary {
            background-color: $primaryBg;
            color: $typeColor;
        }

        &.success {
            background-color: $successBg;
            color: $typeColor;
        }

        &.info {
            background-color: $infoBg;
            color: $typeColor;
        }

        &.warning {
            background-color: $warningBg;
            color: $typeColor;
        }

        &.danger {
            background-color: $dangerBg;
            color: $typeColor;
        }
    }

    $rippleColor: #000000;
    .ripple {
        position: relative;
        overflow: hidden;

        &:after {
            content: "";
            display: block;
            position: absolute;
            width: 100%;
            height: 100%;
            top: 0;
            left: 0;
            pointer-events: none;
            background: radial-gradient(circle, $rippleColor 10%, transparent 10.01%) no-repeat center;
            transform: scale(10, 10);
            opacity: 0;
            transition: transform .5s, opacity 1s
        }

        &:active:after {
            transform: scale(0, 0);
            opacity: .2;
            transition: 0s
        }

    }
</style>
