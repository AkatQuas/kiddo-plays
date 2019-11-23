module.exports = {
    logError: _ => {
        console.log('!!!!ERROR!!!!')
    },

    logSuccess: _ => {
        console.log('~~~SUCCESS~~~')
    },

    logStars: (msg = '') => {
        console.log(`\n****${msg}****`)
    }
}