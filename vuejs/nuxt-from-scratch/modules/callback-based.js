const axios = require('axios')

module.exports = function callbackModule (callback) {
    axios.get('https://httpbin.org/get?id=1&name=qq')
        .then(res => res.data)
        .then(routes => {
            // callback()
        })
}