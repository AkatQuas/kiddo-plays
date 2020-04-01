<template>
    <p class="header">
        <span :class="{active : $i18n.locale === item.lang}" v-for="item in langs" :key="item.lang" @click="setLang(item.lang)">{{ item.label}}</span>
    </p>

</template>

<style lang="less" scoped>
.header {
    text-align: right;
    span {
        padding: 10px 20px;
        cursor: pointer;

        &.active {
            color: rebeccapurple;
            background-color:beige;
        }
    }
}

</style>


<script>
export default {
    name: 'app-header',
    data: ()  => ({
        langs: [
            {
                lang: 'en',
                label: 'English',
            },
            {
                lang: 'cn',
                label: '中文'
            }
        ]
    }),
    methods: {
        setLang(lang) {
            this.$i18n.locale = lang
        }
    }
}
</script>
