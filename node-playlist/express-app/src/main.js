const express = require('express'),
    usersHandler = require('./handlers/usersHandler')

const app = express()
// the order of the middlewares is important
//middleware 
app.use(require('morgan')('dev'))

let responseTime = require('response-time')
app.use(responseTime())

// express static files service
app.use(express.static(__dirname))

app.use((req, res, next) => {
    if (req.url.toLocaleLowerCase() == '/stopnow') {
        res.end('STOP \n')
    } else {
        console.log('don not stop')
        next()
    }
})

// app.method( url Regex, interceptor function, handler function )
// interceptor would execute before the handler
const verify_admin = (req, res, next) => {
    const is_admin = url => /^\/admin\//.test(url)
    if (is_admin(req.url)) {
        next()
    } else {
        res.end('You are not admin, rejected\n')
    }
}
app.get('/admin/users/', verify_admin, (req, res) => {
    res.end('No users in admin system.\n')
})

app.get('/user[s]', usersHandler.get_users)

app.get('/user[s]/:id', (req, res, next) => {
    if (parseInt(req.params.id) < 10000) {
        return next()
    } 
    res.end('You are asking ' + req.params.id + ' whose id is bigger then 10000\n')
})

app.get('/user[s]/:id', (req, res) => {
    res.end('You are asking ' + req.params.id + ' whose id is less then 10000\n')
})

app.get('/user[s]/:id/articles/:articleid', (req, res) => {
    res.end('You are the article asking ' + req.params.articleid + ' of ' + req.params.id)
})

app.get('/ex', (req, res, next) => {
    console.log('in /ex req')
    next()
}, (req, res) => {
    console.log('after next?')
})

app.get('*', (req, res) => {
    res.end('Hello world! \n')
})

const port = process.env.port || 8090;
app.listen(port, _ => {
    console.log('server is listening: ' + port)
})
