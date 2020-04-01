<template>
    <div class="crypto-container">
        <p>What is this page for?</p>
        <p v-for="(value,key) in cryptos" :key="key">
            <span>{{key}}</span> - <span>${{value.USD}}</span>
        </p>
    </div>
</template>
<style lang="scss" scoped>
    .crypto-container {
        background: white;
        padding: 1em;
        width: 60%;
        margin: 0 auto 1.2em auto;
    }
</style>


<script>
    export default {
        data: () => ({
            cryptos: []
        }),
        created () {
            const vm = this;
            vm.$http
              .get('https://min-api.cryptocompare.com/data/pricemulti?fsyms=BTC,ETH,IOT&tsyms=USD')
              .then(res => {
                  console.log(res);
                  vm.cryptos = res;
              }).catch(err => {
                console.error(err);
            });
        }
    };
</script>

