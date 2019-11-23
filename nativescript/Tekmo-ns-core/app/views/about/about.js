var frames = require('ui/frame')
exports.backHome = function (args) {
    return frames.goBack(); 
}

exports.feedBack = function () {
    return frames.topmost().navigate('views/contact-us/contact-us')
}