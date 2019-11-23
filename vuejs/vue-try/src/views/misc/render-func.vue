<template>
    <div>
        <h3>RENDER FUNCTION</h3>
        <div>
            <p>
                Using render function to render the DOM element, haven't found the way to append a vnode to an existing VNode. It seems that the vnode created by <i>this.$createElement</i>
                function is not a well-structured VNode which can not be mounted to the existing VNode as well as shown in the REAL DOM tree.
            </p>
            <p>
                So a practicable way to make it is creating a child components with render function and insert this component into the current VNode.</p>
            <p>A big problem is how to manipulate the VNode!!!!</p>
        </div>
        <button @click="tryCreate">Create method one</button>
        <button @click="tryCreate2">Create method two</button>
        <render-factory text="hello"></render-factory>
        <div ref="mountyou"></div>
        <h3>Plan B</h3>
        <p>Using <i>placeholder</i> in the template string, and <i>split</i>
            it. Then query the parameters hash table, replace the target with the value.</p>
        <p>Check the code!</p>
        <content-render v-for="item in lists" :key="item.id" :target="item.content" :dict="item.parameters">
        </content-render>
    </div>
</template>

<style lang="scss" scoped>

</style>

<script>
    import Vue from 'vue';

    export default {
        data () {
            return {
                lists:
                    [{
                        id: 8,
                        type: '代理信息修改',
                        content: '管理员 $$_admin_$$ 修改代理 $$_agent_$$ 的信息，修改内容：一些内容',
                        time: 1508913665,
                        parameters: {
                            _admin_: { type: 'admin', id: 1, text: 'admin' },
                            _agent_: { type: 'agent', id: 2, text: '萝莉爱好者' }
                        }
                    }, {
                        id: 1,
                        type: '代理信息修改',
                        content: '管理员 $$_admin_$$ 修改代理 $$_agent_$$ 的信息，修改内容：把什么改为了什么\n',
                        time: 1508139615,
                        parameters: {
                            _admin_: { type: 'admin', id: 1, text: 'admin' },
                            _agent_: { type: 'agent', id: 2, text: '萝莉爱好者' }
                        }
                    }, {
                        id: 2,
                        type: '封禁代理',
                        content: '管理员 $$_admin_$$ 封禁代理 $$_agent_$$ ，理由：违反价格公约，低价倾销',
                        time: 1508139615,
                        parameters: {
                            _admin_: { type: 'admin', id: 1, text: 'admin' },
                            _agent_: { type: 'agent', id: 2, text: '萝莉爱好者' }
                        }
                    }, {
                        id: 3,
                        type: '解封代理',
                        content: '管理员 $$_agent_$$ 解封代理 $$_agent_$$',
                        time: 1508139615,
                        parameters: {
                            _admin_: { type: 'admin', id: 1, text: 'admin' },
                            _agent_: { type: 'agent', id: 2, text: '萝莉爱好者' }
                        }
                    }, {
                        id: 4,
                        type: '玩家绑定代理',
                        content: '玩家 $$_player_$$ 绑定代理 $$_agent_$$',
                        time: 1508139615,
                        parameters: {
                            _agent_: { type: 'agent', id: 2, text: '萝莉爱好者' },
                            _player_: { type: 'player', id: 100003, text: '锋削削' }
                        }
                    }, {
                        id: 5,
                        type: '玩家绑定ID',
                        content: '玩家 $$_player_$$ 绑定玩家ID：100006',
                        time: 1508139615,
                        parameters: { _player_: { type: 'player', id: 100006, text: '锋削削' } }
                    }, {
                        id: 6,
                        type: '代理赠送房卡给玩家',
                        content: '代理 $$_agent_$$ 赠送 $$_order_$$ 张房卡给玩家 $$_player_$$',
                        time: 1508139615,
                        parameters: {
                            _agent_: { type: 'agent', id: 2, text: '萝莉爱好者' },
                            _order_: { type: 'order', id: 77, text: 2 },
                            _player_: { type: 'player', id: 100011, text: '锋削削' }
                        }
                    }, {
                        id: 7,
                        type: '代理购买房卡',
                        content: '代理 $$_agent_$$ 购买 $$_order_$$ 张房卡',
                        time: 1508139615,
                        parameters: {
                            _agent_: { type: 'agent', id: 2, text: '萝莉爱好者' },
                            _order_: { type: 'order', id: 56, text: 80 }
                        }
                    }]

            };
        },
        methods: {
            tryCreate () {
                const vm = this;
                console.log(this);
                const h1tag = vm.$createElement('h1', 'This is an h1 tag');
                console.log(h1tag);
            },
            tryCreate2 () {
                const profile = Vue.extend({
                    template: '<p>Create </p>'
                });
                new profile().$mount(this.$refs.mountyou);
//                which is a good way to implement the route!!!
            }
        },
        components: {
            RenderFactory: {
                props: {
                    text: String
                },
                render (h, c) {
                    console.log(c);
                    return h('p', this.text);
                }
            },
            ContentRender: {
                props: {
                    target: {
                        type: String,
                        required: true
                    },
                    dict: {
                        type: Object,
                        required: true
                    }
                },
                render (h) {
                    const vm = this;
                    return h('p', {
                            style: { margin: 0 }
                        }, vm.target.split('$$').map(v => {
                            if ( vm.dict.hasOwnProperty(v) ) {
                                const o = vm.dict[v];
                                return h('span', {
                                    style: {
                                        color: '#f17c67',
                                        fontStyle: 'italic'
                                    },
                                    on: {
                                        click: _ => {
                                            console.log(o);
                                        }
                                    }
                                }, o.text);
                            } else {
                                return v;
                            }
                        })
                    );
                }
            }
        },
        mounted () {
            this.tryCreate();
        }
    };
</script>
