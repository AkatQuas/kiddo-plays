const http = require('http'),
    https = require('https'), 
    fs = require('fs'),
    url = require('url')

const { resolve } = require('./utils')


const PICFUZZYREG = /src="(\S+?(jpe?g|png|gif))"/gi

const parseURL = imageURL => {
    if ( !imageURL.match(/^https?/gi)) {
        imageURL = 'https:' + imageURL
    } 
    const last = imageURL.lastIndexOf('/') + 1
    const parsed = url.parse(imageURL)


    return Object.assign(parsed ,{
        filename: imageURL.slice(last),
    })
}

const imageCB = (o, res) => {
    let imgData = '';
    res.setEncoding('binary')
    res.on('data', chunk => {
        imgData += chunk
    })
    res.on('end', _ => {
        fs.writeFile(resolve('images/' + o.filename), imgData, 'binary', err => {
            if (err) {
                console.log(err)
                return console.log('failed -> ' + o.filename)
            } else {
                console.log(' success -> ' + o.filename)
            }
        })
    })
}

const imageDownloader = images => {
    const done = 0, l = images.length

    images.forEach((imageURL, i) => {
        const o = parseURL(imageURL)
        console.log(o)
        if (o.protocol.indexOf('https') > -1 ) {
            https.get(o.href, res => { 
                imageCB(o, res)
            })
        } else { 
            http.get(o.href, res => {
                imageCB(o, res)
            })
        }
    })
}

module.exports = {
    PICFUZZYREG,
    imageDownloader
}