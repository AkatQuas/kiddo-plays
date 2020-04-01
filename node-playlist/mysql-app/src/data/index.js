const RANDOMSTR = 'mtmxzrhxdqzozrvdsjeuylyttaykyqpqbvnbdupmqitezlfscitjclukliqnuexhwytzjxtycyfemxklgwvayxdyluyzgcdxawvk'
const STATES = require('./statesData')
const USERS = require('./addressData').map(v => {
    const stateNo = ~~(Math.random() * STATES.length)
    const cityNo = ~~(Math.random() * (RANDOMSTR.length - 8))
    const zipCode = (~~(Math.random() * 9999 + 100000)).toString().slice(1)
    const account = ~~(Math.random() * 1000 + 100)

    return {
        name: v.name,
        address: v.address,
        state: STATES[stateNo],
        city: RANDOMSTR.substr(cityNo, 6),
        zip: zipCode,
        account
    }
})

const SELLINGITEMS = new Array(50).fill(0).map(_ => {
    const nameNo = ~~(Math.random() * (RANDOMSTR.length - 8))
    const cost = ~~(Math.random() * 50) + 5
    const seller_id = ~~(Math.random() * USERS.length) + 1
    return {
        name: RANDOMSTR.substr(nameNo, 8),
        cost, 
        seller_id
    }
})

module.exports = {
    USERS,
    SELLINGITEMS
}