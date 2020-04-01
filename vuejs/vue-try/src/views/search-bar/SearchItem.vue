<template>
    <div class="search-item">
        <label class="search-title">{{item.title}}：</label>
        <template v-if="item.type === 'select' ">
            <select @change="changeValue" :value="item.value" class="search-input">
                <option value="">未选择</option>
                <option
                        v-for="opt in item.options"
                        :value="opt.value"
                        :key="opt.value"
                >
                    {{opt.title}}
                </option>
            </select>
        </template>

        <template v-else-if="item.type === 'date' ">
            <input type="date" class="date-input" @change="dateFromChange" :max="dateMax" :value="item.dmin"
                   ref="dateFrom"> -
            <input type="date" class="date-input" @change="dateToChange" :max="dateMax" :min="dateMin"
                   :value="item.dmax" ref="dateTo">
        </template>

        <template v-else>
            <input
                    :type="item.type"
                    :value="item.value"
                    class="search-input"
                    @change="changeValue">
        </template>
    </div>
</template>

<style lang="scss" scoped>
    .search-item {
        display: inline-block;
        width: 340px;
        padding: 1px 0;
        margin-bottom: 10px;

        .search-title {
            float: left;
            top: 0;
            font-size: 14px;
            text-align: right;
            width: 100px;
            line-height: 23px;
            font-weight: bold;
            margin-right: 10px;
        }

        .search-input {
            width: 220px;
            height: 25px;
            border-radius: 3px;
            border: 1px solid #dbdbdb;
            line-height: 20px;
            background-color: white;
        }

        .date-input {
            width: 120px;
        }
    }

</style>

<script>
    export default {
        props: {
            item: {
                type: Object,
                required: true
            }
        },
        data () {
            return {
                dateMin: '',
                dateMax: ''
            };
        },
        methods: {
            changeValue (e) {
                this.item.value = e.target.value;
                this.emitUpdate();
            },
            dateFromChange (e) {
                this.item.dmin = this.dateMin = e.target.value;
                this.emitUpdate();
            },
            dateToChange (e) {
                this.item.dmax = e.target.value;
                this.emitUpdate();
            },
            emitUpdate () {
                this.$emit('update:item', this.item);
            },
            calculateMax () {
                const d = new Date();
                const y = d.getFullYear(),
                    m = d.getMonth() + 1,
                    rm = m < 10 ? '0' + m : m,
                    day = d.getDate();
                this.dateMax = `${y}-${rm}-${day}`;
            }
        },
        mounted () {
            const { item } = this;
            if ( item.type === 'date' ) {
                this.calculateMax();
            }
        }
    };
</script>
