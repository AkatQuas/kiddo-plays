exports.make_error = (err, msg) => {
    const e = new Error(msg)
    e.code = err
    return e
}

exports.send_success = (res, data) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    const output = { error: null, data: data }
    res.end(JSON.stringify(output) + '\n')
}

exports.send_failure = (res, code, err) => {
//    code = err.code ? err.code : code 
    res.writeHead(code, { 'Content-Type': 'application/json' })
    const output = { error: code, message: err.message }
    res.end(JSON.stringify(output) + '\n')
}

exports.invalid_resource = () => {
    return make_error('invalid_resource', 'the requested resource does not exist')
}
