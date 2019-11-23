<template>
    <p>
        open console before looking at this page,
    </p>
</template>

<style lang="scss" scoped>

</style>

<script>
    export default {
        created () {
            function runAsync () {
                return new Promise(function (resolve, reject) {
                    setTimeout(function () {
                        console.log('done');
                        if ( Math.random() > 0.5 ) {
                            resolve('data');
                        } else {
                            reject('error1');
                            // resolve('data');
                        }

                    }, 2000);
                });
            }

            function runAsync2 () {
                return new Promise(function (resolve, reject) {
                    setTimeout(function () {
                        console.log('done2');
                        if ( Math.random() > 0.5 ) {
                            resolve('data2k');
                        } else {
                            reject('error2k');
                            // resolve('data2k');
                        }

                    }, 5000);
                });
            }

            function runAsync3 () {
                return new Promise(function (resolve, reject) {
                    setTimeout(function () {
                        console.log('done3');
                        if ( Math.random() > 0.5 ) {
                            resolve({ k: 'data3' });
                        } else {
                            reject('error3');
                            // resolve('data3');
                        }

                    }, 2000);
                });
            }

            Promise.all([runAsync(), runAsync2(), runAsync3()]).then((result) => {
                console.log(result);
            }).catch((reason) => {
                console.log(reason);
            });
            const pro = new Promise((resolve, rejcet) => {
                setTimeout(() => {
                    console.log('??');
                }, 2000);
            });

            Promise.resolve(42).then(function (value) {
                console.log(value);
                throw 'bug';
            }).then(function (hh) {
                console.log('after', 42);
                console.log(hh);
            }, (reason) => {
                console.log(reason);
            });
        }
    };
</script>
