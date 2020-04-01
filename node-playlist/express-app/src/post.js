const express = require('express'),
    morgan = require('morgan'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    session = require('express-session')

const app = express()

app.use(morgan('dev'))

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(session({
    secret: 'cats on the keyboard',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 10000 }
}))

app.use((req, res) => {
    console.log(req.session)
    const x = req.session.last_access;
    console.log(x)
    req.session.last_access = new Date()
    res.end('on session no more but your time is '+ x)
})

app.post('/body', (req, res) => {
    res.end(JSON.stringify(req.body, 0, 2) + '\n')
})

// curl -i -X POST -H 'Content-type:application/json' -d '{"a":1,"b":"abc" }' http://localhost:9090/body

app.get('*', (req, res) => {
    res.cookie('pet', 'zimbu the monkey', { expires: new Date(Date.now() + 864000000) })
    // res.clearCookie() 
    res.end('You are doomed')
})

app.listen(9090)