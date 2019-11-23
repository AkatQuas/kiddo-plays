const events = require('events')

function Downloader () {
}

Downloader.prototype = new events.EventEmitter()
Downloader.prototype.__proto__ = events.EventEmitter.prototype
Downloader.prototype.url = null
Downloader.prototype.download_url = function (path) {
    const self = this
    self.url = path
    self.emit('start', path)
    setTimeout(function () {
        self.emit('end', path)
    }, 2000)
}

const d = new Downloader()

d.on('start', function (path) {
    console.log(`start downloading: ${path}`)
})

d.on('end', function (path) {
    console.log(`finished downloading: ${path}`)
})

d.download_url(`http://hello.com`)
