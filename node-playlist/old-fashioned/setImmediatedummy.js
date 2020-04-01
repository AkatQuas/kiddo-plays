console.log('before immediate');

setImmediate(args => {
    console.log(`executing immediate: ${args}`);
}, 'so immediate');

console.log('after immediate');
