const axios = require('axios')

module.exports = function promiseModule () {
    return axios.get('https://httpbin.org/get?id=2&name=qq')
        .then(res => res.data)
        .then(routes => {
            // Do something by extending Nuxt routes
        })
}