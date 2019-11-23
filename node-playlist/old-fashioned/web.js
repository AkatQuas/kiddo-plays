const http = require('http'),
    fs = require('fs'),
    url = require('url')

function serve_page (req, res) {
    const parsed_url = url.parse(req.url, true),
        url_method = req.method.toLowerCase()
    const core_url = parsed_url.pathname,
        page = core_url.substring(1)
    fs.readFile(page, function (err, contents) {
        if ( err ) {
            return send_failure(res, 500, err)
        }
        contents = contents.toString('utf8')
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(contents)
    })
}

function load_album_list (cb) {
    fs.readdir('albums', function (err, files) {
        if ( err ) {
            return cb(make_error('file_error', JSON.stringify(err)))
        }
        let only_dirs = [];
        (function iterator (index) {
            console.log(arguments, '123')
            if ( index === files.length ) {
                return cb(null, only_dirs)
            }
            fs.stat(`albums/${files[index]}`, function (err, stats) {
                if ( err ) {
                    return cb(make_error('file_error', JSON.stringify(err)))
                }
                if ( stats.isDirectory() ) {
                    only_dirs.push({ name: files[index] })
                }
                iterator(index + 1)
            })
        })(0)
    })
}

function load_album (album_name, page, page_size, cb) {
    fs.readdir(`albums/${album_name}`, function (err, files) {
        if ( err ) {
            console.log(err)
            if ( err.code === 'ENOENT' ) {
                cb(no_such_album())
            } else {
                cb(make_error('file_error', JSON.stringify(err)))
            }
            return
        }

        var only_files = [];

        (function iterator (index) {
            if ( index === files.length ) {
                const ps = only_files.splice(page * page_size, page_size)
                const obj = {
                    short_name: album_name,
                    photos: ps
                }
                return cb(null, obj)
            }
            fs.stat(`albums/${album_name}/${files[index]}`, function (err, stats) {
                if ( err ) {
                    return cb(make_error('file_error', JSON.stringify(err)))
                }
                if ( stats.isFile() ) {
                    const obj = {
                        filename: files[index],
                        desc: files[index]
                    }
                    only_files.push(obj)
                }
                return iterator(index + 1)
            })
        })(0)
    })
}

function handle_list_albums (req, res) {
    load_album_list(function (err, albums) {
        if ( err ) {
            return send_failure(res, 500, err)
        }

        send_success(res, { albums: albums })
    })
}

function handle_get_album (req, res) {
    const parsed_url = url.parse(req.url, true),
        query = parsed_url.query
    let page_num = query.page ? query.page : 0,
        page_size = query.page_size ? query.page_size : 1000,
        core_url = parsed_url.pathname

    if ( isNaN(parseInt(page_num)) ) page_num = 0
    if ( isNaN(parseInt(page_size)) ) page_size = 1000

    const album_name = core_url.substr(8, core_url.length - 13)
    load_album(album_name, page_num, page_size, function (err, album_contents) {
        if ( err && err.error === 'no_such_album' ) {
            send_failure(res, 404, err)
        } else if ( err ) {
            send_failure(res, 500, err)
        } else {
            send_success(res, { album_data: album_contents })
        }
    })
}
function do_rename(old_name, new_name, callback) {
    // Rename the album folder.
    fs.rename("albums/" + old_name,
        "albums/" + new_name,
        callback);
}

function handle_rename_album (req, res) {
    const parsed_url = url.parse(req.url, true),
        core_url = parsed_url.pathname,
        parts = core_url.split('/')

    if ( parts.length !== 4 ) {
        return send_failure(res, 404, invalid_resource(core_url))
    }

    const album_name = parts[2]
    let json_body = ''
    req.on('readable', function () {
        let d = req.read()
        if ( d ) {
            if ( typeof d === 'string' ) {
                json_body += d
            } else if ( typeof d === 'object' && d instanceof Buffer ) {
                json_body += d.toString('utf8')
            }
        }
    })

    req.on('end', function () {
        if ( json_body ) {
            try {
                const album_data = JSON.parse(json_body)
                if ( !album_data.album_name ) {
                    return send_failure(res, 403, miss_data('album_name'))
                }
            } catch ( e ) {
                return send_failure(res, 403, bad_json())
            }
            do_rename(album_name, album_data.album_name, function (err, results) {
                if ( err && err.code === 'ENOENT' ) {
                    return send_failure(res, 403, no_such_album())
                } else if ( err ) {
                    return send_failure(res, 500, file_error(err))
                }
                send_success(res, null)
            })
        } else {
            send_failure(res, 403, bad_json())
            res.end()
        }
    })
}

function make_error (err, msg) {
    const e = new Error(msg)
    e.code = err
    return e
}

function send_success (res, data) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    const output = { error: null, data: data }
    res.end(JSON.stringify(output) + '\n')
}

function send_failure (res, code, err) {
//    code = err.code ? err.code : code 
    res.writeHead(code, { 'Content-Type': 'application/json' })
    const output = { error: code, message: err.message }
    res.end(JSON.stringify(output) + '\n')
}

function invalid_resource () {
    return make_error('invalid_resource', 'the requested resource does not exist')
}

function no_such_album () {
    return make_error('no_such_album', 'The specified album does not exist')
}
function content_type_for_path (file) {
    var ext = path.extname(file);
    switch (ext.toLowerCase()) {
        case '.html': return "text/html";
        case ".js": return "text/javascript";
        case ".css": return 'text/css';
        case '.jpg': case '.jpeg': return 'image/jpeg';
        default: return 'text/plain';
    }
}
function serve_static_file(file, res) {
    const rs = fs.createReadStream(file);
    const ct = content_type_for_path(file);
    res.writeHead(200, { "Content-Type": ct });

    rs.on('error', (e) => {
        res.writeHead(404, { "Content-Type": "application/json" });
        const out = {
            error: "not_found",
            message: "'" + file + "' not found"
        };
        return res.end(JSON.stringify(out) + "\n");

    });

    rs.on('readable', () => {
        let d = rs.read();
        if ( d ) {
            res.write(d);
        }
    });

    rs.on('end', () => {
        res.end();  // we're done!!!
    });
}

function process_request (req, res) {
    console.log(`In coming request: ${req.method} ${req.url}`)
    const parsed_url = url.parse(req.url, true),
        url_method = req.method.toLowerCase()
    const core_url = parsed_url.pathname
    if ( core_url.substring(0, 7) === '/pages/' ) {
        serve_page(req, res)
    } else if ( core_url.substring(0, 11) === '/templates/' ) {
        serve_static_file('templates/' + core_url.substring(11), res)
    } else if ( core_url.substring(0, 9) === '/contents/' ) {
        serve_static_file('contents' + core_url.substring(9), res)
    } else if ( core_url === '/albums.json' && url_method === 'get' ) {
        handle_list_albums(req, res)
    } else if ( core_url.substr(core_url.length - 12) === '/rename.json' && url_method === 'post' ) {
        handle_rename_album(req, res)
    } else if ( core_url.substr(0, 7) === '/albums' && core_url.substr(req.url.length - 5) === '.json' && url_method === 'get' ) {
        handle_get_album(req, res)
    } else {
        send_failure(res, 404, invalid_resource())
    }
}

const s = http.createServer(process_request)

const port = 8080
s.listen(port)
console.log(`server is listening at port: ${port}`)
