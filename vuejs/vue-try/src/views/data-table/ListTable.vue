<template>
    <div :class="tableCls">
        <table>
            <thead>
            <tr>
                <th v-for="col in columns" :key="col.field">
                    {{col.title}}
                </th>
            </tr>
            </thead>

            <tbody>
            <template v-if="listData.length === 0">
                <tr>
                    <td :colspan="columns.length">{{emptyMsg}}</td>
                </tr>
            </template>

            <template v-else v-for="(item,idx) in listData">
                <tr @click="clickRow(item)" :key="idx">
                    <td v-for="col in columns" :key="item[col.field]">
                        <slot :item="item" :field="col.field" :content="item[col.field]">
                            <span>{{item[col.field]}}</span>
                        </slot>
                    </td>
                </tr>
            </template>
            </tbody>
            <tfoot v-if="$slots.foot || false">
            <slot name="foot"></slot>
            </tfoot>
        </table>
    </div>
</template>

<style lang="scss" scoped>
    .list-table {
        position: relative;
        width: 95%;
        margin: 0 auto;

        &.bordered {
            tr {
                th, td {
                    border-right: 1px solid #e9e9e9;
                }
            }
            thead {
                tr {
                    border-bottom: 1px solid #e9e9e9;
                }
            }
            tfoot {
                tr {
                    border-top: 1px solid #e9e9e9;
                }
            }
        }

        table {
            background-color: #ffffff;
            border: 1px solid #dedede;
            border-spacing: 0;
            width: 100%;
            border-collapse: collapse;
            vertical-align: middle;
            text-align: center;

            thead {
                background-color: #f1f1f1;

                th {
                    border: none;
                    color: #333333;
                    padding: 8px 0;
                }
            }

            tbody {

                tr {
                    border: none;
                    line-height: 30px;

                    &:nth-child(even) {
                        background-color: #f7f7f7;
                    }

                    &:hover {
                        background-color: #f1f4f9;
                    }
                }
            }

            tfoot {
                td {
                    padding: 10px;
                }
            }
        }
    }
</style>

<script>
    export default {
        name: 'list-table',
        props: {
            columns: {
                type: Array,
                required: true
            },
            listData: {
                type: Array,
                required: true
            },
            emptyMsg: {
                type: String,
                default: '老板，暂时没有可以显示的数据……'
            },
            bordered: {
                type: Boolean,
                default: false
            }
        },
        data () {
            return {};
        },
        computed: {
            tableCls () {
                return ['list-table', { bordered: this.bordered }];
            }
        },
        methods: {
            clickRow (item) {
                this.$emit('click-row', item);
            }
        }
    };
</script>
