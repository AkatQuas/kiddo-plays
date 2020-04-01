const amgr = require('./album_mgr')

amgr.albums('./', function (err, albums) {
    if (err) {
        return console.log(`Unexpected error: ${JSON.stringify(err)}`)
    }
    
    (function iterator(index) {
        if (index === albums.length) {
            return console.log('Done')
        }
        albums[index].photos(function (err, photos) {
            if (err) {
                return console.log(`Err loading album: ${JSON.stringify(err)}`)
            }

            console.log(albums[index].name)
            console.log(photos)
            console.log('')
            return iterator(index+1)
        })
    })(0)
})

