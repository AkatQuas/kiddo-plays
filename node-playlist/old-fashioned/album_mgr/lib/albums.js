const fs = require('fs'),
    album = require('./album.js')

exports.version = '1.0.0'

exports.albums = function (root, callback) {
    fs.readdir(`${root}/albums`, function(err, files) {
        if (err) {
            callback(err)
            return
        }
        let album_list = [];

        (function iterator(index) {
            if (index === files.length) {
                callback(null, album_list)
                return
            }
            fs.stat(`${root}/albums/${files[index]}`, function (err, stats) {
                if (err) {
                    callback({ 
                        error: 'file_error',
                        message: JSON.stringfy(err)
                    })
                    return
                }
                if (stats.isDirectory()) {
                    const p = `${root}/albums/${files[index]}`
                    album_list.push(album.create_album(p))
                }
                iterator(index+1)
            })
        })(0)
    })
}
