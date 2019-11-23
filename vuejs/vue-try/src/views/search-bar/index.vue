<template>
    <div>
        <p>self-made wheel</p>
        <p>You pass an array of form-item list to <i>SearchBar</i>
            component and fill the form, hit the submit button, check the console. The value would change synchronously.
        </p>
        <pre>
           searchList: [
                    {title:'城市', field:'city', type: 'text',value:''},
                    {title:'姓名', field:'name', type: 'text',value:''},
                    {title:'姓名', field:'name', type: 'password',value:''},
                    {title:'姓名', field:'name', type: 'select',value:'',
                        options:[{title:'USA',value:'usa'},{title:'UK',value:'uk'}]
                    },
                ]
        </pre>

        <search-bar
                :search-list.sync="searchList"
                @submit-search="doSearch"
        ></search-bar>
    </div>
</template>

<style lang="scss" scoped>

</style>

<script>
    import SearchBar from './SearchBar.vue';

    export default {
        data () {
            return {
                searchList: [
                    { title: '城市', field: 'city', type: 'text', value: '' },
                    { title: '姓名', field: 'name', type: 'text', value: '' },
                    { title: '时间段', field: 'period', type: 'date', dmin: '', dmax: '' },
                    { title: 'password', field: 'password', type: 'password', value: '' },
                    {
                        title: 'country',
                        field: 'country',
                        type: 'select',
                        value: '',
                        options: [{ title: 'USA', value: 'usa' }, { title: 'UK', value: 'uk' }]
                    }
                ]
            };
        },
        methods: {
            doSearch () {
                console.log(this.searchList);
            }
        },
        components: {
            SearchBar
        }
    };
</script>
