const fs = require('fs'),
    async = require('async')

function load_file_contents(path, callback) {
    async.waterfall([
        function (callback) {
            fs.open(path, 'r', callback)
        },

        function (f, callback) {
            fs.fstat(f, function (err, stats) {
                if (err) {
                    callback(err)
                } else {
                    callback(null, f, stats)
                }
            })
        },

        function (f, stats, callback) {
            if (stats.isFile()) {
                let b = new Buffer(10000)
                fs.read(f, b, 0, 10000, null, function (err, br, buf) {
                    if (err) {
                        callback(err)
                    } else {
                        callback(null, f, b.toString('utf8', 0, br))
                    }
                })
            } else {
                callback({ error: 'not_file', message: `Can not load directory` })
            }
        },

        function (f, contents, callback) {
            fs.close(f, function (err) {
                if (err) {
                    callback(err)
                } else {
                    callback(null, contents)
                }
            })
        } 
    ],

    function (err, file_contents) {
        callback(err, file_contents)
    })
}
