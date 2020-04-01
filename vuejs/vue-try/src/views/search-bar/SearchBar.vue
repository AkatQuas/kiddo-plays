<template>
    <div class="search-bar">
        <template>
            <search-item
                    v-for="(item,idx) in searchList"
                    :key="idx"
                    :item.sync="item"
            ></search-item>
        </template>
        <div class="search-btn-group">
            <span class="mybtn mybtn-grey" @click="resetAll">{{resetText}}</span>
            <span class="mybtn mybtn-orange" @click="submitAll">{{confirmText}}</span>
        </div>
    </div>
</template>

<style lang="scss" scoped>
    .search-bar {
        position: relative;
        margin: 10px 0;
        text-align: left;

        .search-btn-group {
            text-align: right;

            span {
                text-align: center;
                margin: 10px;
            }
        }
    }

</style>

<script>
    import SearchItem from './SearchItem.vue';

    export default {
        name: 'search-bar',
        props: {
            searchList: {
                type: Array,
                required: true
            },
            resetText: {
                type: String,
                default: '清空'
            },
            confirmText: {
                type: String,
                default: '查找'
            }
        },
        data () {
            return {};
        },
        methods: {
            submitAll () {
                this.emitUp();
            },
            resetAll () {
                this.searchList.forEach(v => {
                    if ( v.type === 'date' ) {
                        v.dmin = v.dmax = '';
                    } else {
                        v.value = '';
                    }
                });
                this.emitUp();
            },
            emitUp () {
                this.$emit('update:searchList', this.searchList);
                this.$emit('submit-search-bar');
            }
        },
        components: {
            SearchItem
        }
    };
</script>
