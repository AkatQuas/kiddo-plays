const http = require('http'),
    fs = require('fs'),
    path = require('path')

function handle_incoming_request(req, res) {
    if (req.method.toLowerCase() === 'get' && req.url.substring(0,9) === '/content/') {
        serve_static_file(req.url.substring(9), res)
    } else {
        return not_found_resource(req.url, res)
    }
}

/*
function serve_static_file(file, res) {
    const rs = fs.createReadStream(file),
        ct = content_type_for_path(file)

    res.writeHead(200, {'Content-Type': ct})

    rs.on('readable', function () {
        const d = rs.read()
        if (d) {
            let str_to_write
            if (typeof d === 'string') {
                str_to_write = d
            } else if (typeof d === 'object' && d instanceof Buffer) {
                str_to_write = d.toString('utf8')
            }

            if (!res.write(str_to_write)) {
                rs.pause();
            }
        }
    })

    rs.on('drain', _ => {
        rs.resume()
    })

    rs.on('end', function () {
        res.end()
    }) 

    rs.on('error', function (e) {
        return not_found_resource(file, res)
    })
}
*/

function serve_static_file(file, res) {
    fs.exists(file, function (exists) {
        if (!exists) {
            return not_found_resource(file, res)
        }
        const rs = fs.createReadStream(file)

        rs.on('error', function (e) {
            console.log(`Error! ${JSON.stringify(e)}`)
            res.end('')
        })

        const ct = content_type_for_path(file) 
        res.writeHead(200, {'Content-Type': ct})
        rs.pipe(res)
    })
}

function content_type_for_path(file) {
    const ext = path.extname(file)

    switch (ext.toLowerCase()) {
        case '.html': return 'text/html';
        case '.js': return 'text/javascript';
        case '.css': return 'text/css';
        case '.jpg': case '.jpeg': return 'image/jpeg';
        default: return 'text/plain';
    }

}

function not_found_resource(resource, res) {
    res.writeHead(404, {'Content-Type': 'application/json'})
        const out = {
            error: 'resource_not_found',
            message: `${resource} not found`
        }
    res.end(JSON.stringify(out) + '\n')
    return
}
const s = http.createServer(handle_incoming_request)
const port = 8080
s.listen(port)
console.log(`Server listening on ${port}`)
