const fs = require('fs');
let contents
const filename = 'atest.js'
const rs = fs.createReadStream(filename)

rs.on('readable', function() {
    let str
    const d = rs.read()
    console.log('d instance',d instanceof Buffer)
    if (d) {
        if (typeof d === 'string') {
            str = d
        } else if (typeof d === 'object' && d instanceof Buffer) {
            str = d.toString('utf8')
        }

        if (str) {
            if (!contents) {
                contents = d
            } else {
                contents += d
            }
        }
    }
})

rs.on('end', function () {
    console.log(`read in the file contents: 
    ${contents.toString('utf8')}`)
})

rs.on('error', err => {
    console.log('I got an error reading the stream: ' + JSON.stringify(err))
})
