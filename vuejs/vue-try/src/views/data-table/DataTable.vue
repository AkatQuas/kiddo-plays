<template>
    <div>
        <div class="data-table">
            <table>
                <thead>
                <tr>
                    <th
                            v-for="(col,idx) in columns"
                            :key="idx"
                    >{{col.title}}
                    </th>
                </tr>
                </thead>

                <tbody>
                <template v-if="currentData.length === 0">
                    <tr>
                        <td :colspan="columns.length">
                            {{emptyMsg}}
                        </td>
                    </tr>
                </template>
                <template v-else>
                    <tr v-for="(item,index) in currentData" :key="index">
                        <td v-for="(col,idx) in columns" :key="idx">
                            <slot name="td" :item="item" :field="col.field" :content="item[col.field]" :row="index"
                                  :col="idx">
                                {{item[ col.field ]}}
                            </slot>
                        </td>
                    </tr>
                </template>
                </tbody>
            </table>
        </div>
        <div v-if="currentData.length !== 0">
            <div class="clearfix">
                <div class="records">
                    <p>共 <span>{{ pagination.total }}</span> 条记录，当前显示第 <span>{{ pagination.current }}</span> 页</p>
                </div>
                <select class="page-size" @change="changeSize($event)">
                    <option
                            v-for="item in pageSize"
                            :key="item"
                            :value="item">{{item}}/页
                    </option>
                </select>
                <div class="page-nav">
                    <paginate
                            ref="paginate"
                            :page-count="pagination.total_pages"
                            :click-handler="changePage"
                            prev-text="上一页" next-text="下一页"
                            prev-class="page-item long" next-class="page-item long" page-class="page-item">
                    </paginate>
                </div>
            </div>
        </div>
    </div>
</template>
<style lang="scss">
    @import 'paginate';
</style>
<style lang="scss" scoped>
    .data-table {
        position: relative;

        table {
            background-color: white;
            border: 1px solid #dedede;
            border-spacing: 0;
            width: 100%;
            border-collapse: collapse;
            vertical-align: middle;
            text-align: center;

            thead {
                background-color: #343f51;
                display: table-header-group;

                th {
                    border: none;
                    color: white;
                    padding: 8px;
                }
            }

            tbody {
                display: table-row-group;

                tr {
                    display: table-row;
                    vertical-align: inherit;
                    border: none;
                    height: 45px;
                    line-height: 45px;

                    &:nth-child(even) {
                        background-color: #f7f7f7;
                    }

                    &:hover {
                        background-color: #f1f4f9;
                    }

                    .linkbtn {
                        color: #ff8f35;
                        cursor: pointer;

                        &:hover {
                            color: #ff7200;
                        }
                    }
                }
            }
        }

    }
</style>

<script>
    import Paginate from 'vuejs-paginate';

    export default {
        name: 'data-table',
        props: {
            columns: {
                type: Array,
                required: true
            },
            loadData: {
                type: Function,
                required: true
            },
            pageSize: {
                type: Array,
                default: () => [ 10, 20, 30, 40, 50 ]
            },
            emptyMsg: {
                type: String,
                default: '老板，暂时没有找到你要的东西……'
            }
        },
        data() {
            return {
                currentData: [],
                pagination: {
                    total: 0,
                    current: 1,
                    size: 10,
                    total_pages: 1
                }
            };
        },
        watch: {
            pagination( n ) {
                if ( !this.$refs.paginate ) {
                    return false;
                }
                this.$refs.paginate.selected = (n.current - 1);
            }
        },
        components: {
            Paginate
        },
        methods: {
            getData() {
                const vm = this;
                this.loadData(vm.pagination).then(res => {
                    vm.currentData = res.result.slice(0);
                    vm.pagination = res.pagination;
                }).catch(err => {
                    console.error(err);
                });
            },
            changePage( page ) {
                this.pagination.current = page;
                this.getData();
            },
            changeSize( e ) {
                this.pagination.size = e.target.value;
                this.getData();
            },
            refresh() {
                this.getData();
            },
            reload() {
                this.changePage(1);
            }
        },
        created() {
            this.getData();
        }
    };
</script>
