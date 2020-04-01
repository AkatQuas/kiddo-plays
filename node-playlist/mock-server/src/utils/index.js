module.exports = {
    trimArray: (array, size = 5, base = 3) => {
        const length = ~~(Math.random() * size + base);
        const sp = ~~(Math.random() * (array.length - length));
        return array.slice(sp, sp + length);
    },
    oneFromArray: array => array[~~(Math.random() * array.length)]
};


