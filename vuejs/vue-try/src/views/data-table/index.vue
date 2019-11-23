<template>
    <div>
        <p>This is a self-made data table which can load data automatically when click the pagination part.</p>
        <p>You have to inject <i>columns(Array), loadData(Asynchronous Function based on Promise)</i>
            and some required props.</p>
        <p>One major dependency is <i>vuejs-paginate</i></p>
        <p>I have over written the class of the style which is very easy to customize.</p>

        <data-table :columns="columns" :loadData="loadData"></data-table>
        <p>
            Customize the slot
        </p>
        <data-table :columns="columns" :loadData="loadData">
            <template slot="td" slot-scope="props">
                <span v-if="props.field === 'one'"> over write the column one </span>
                <span v-else>{{props.content}}</span>
            </template>
        </data-table>
        <hr>
        <p>Maybe update the data table in the future. </p>
        <hr>
        <p>A table just for show the data: <i>list-table</i></p>
        <list-table
                :columns="columns"
                :listData="listData"
        ></list-table>

    </div>
</template>

<style lang="scss" scoped>

</style>

<script>
    import DataTable from './DataTable.vue';
    import ListTable from './ListTable.vue';

    export default {
        data () {
            return {
                columns: [
                    { title: 'Col one', field: 'one' },
                    { title: 'Col two', field: 'two' },
                    { title: 'Col three', field: 'three' }
                ],
                loadData () {
                    return new Promise((resolve, reject) => {
                        setTimeout(_ => {
                            const data = [
                                { one: 11, two: 12, three: 13 },
                                { one: 21, two: 22, three: 23 },
                                { one: 31, two: 32, three: 33 }
                            ];
                            const res = {
                                result: data,
                                pagination: {
                                    total: 3,
                                    current: 1,
                                    total_pages: 1,
                                    size: 10
                                }
                            };
                            resolve(res);
                        }, 2000);
                    });
                },
                listData: [
                    { one: 11, two: 12, three: 13 },
                    { one: 21, two: 22, three: 23 },
                    { one: 31, two: 32, three: 33 }
                ]
            };
        },
        components: {
            ListTable,
            DataTable
        }
    };
</script>
