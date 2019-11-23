const http = require('http'),
    https = require('https'),
    url = require('url')

const downloader = (targetURL, callback) => {
    targetURL = url.parse(targetURL)

    console.log(targetURL)
    const downloadCB = res => {
        let data = "";
        res.on('data', chunk => {
            data += chunk;
        });
        res.on("end", _ => {
            callback(null, data);
        });
    }
    if (/^https/.test(targetURL.protocol)) {
        https.get(targetURL.href, downloadCB).on('error', err => {
            callback(err)
        })
    } else {
        http.get(targetURL.href, downloadCB).on('error', _ => {
            callback(err)
        })
    }
}

module.exports = {
    downloader
}
