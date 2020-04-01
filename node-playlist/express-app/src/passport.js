const express = require('express'),
    cookieParser = require('cookie-parser'),
    session = require('express-session'),
    passport = require('passport'),
    localStrategy = require('passport-local').Strategy,
    bodyParser = require('body-parser'),
    flash = require('express-flash')

const app = express()

app.use(flash())
app.use(session({
    secret: ' cat_on_sky',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}))

app.use(cookieParser('cat_on_sky'))
app.use(passport.initialize())
app.use(passport.session())

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

const authenticatedOrNot = (req, res, next) => {
    if(req.isAuthenticated()) {
        next();
    } else {
        res.redirect('/login')
    }
}

// 1. store user names and passwords
let users = {
    id123: { id: 123, username: 'marcwan', password: 'boo' },
    id1: { id: 1, username: 'admin', password: 'admin' },
}
// 2. configure passport-local to validate an incoming request with username + pw
passport.use(new localStrategy((username, password, done) => {
    Object.keys(users).forEach(key => {
        const user = users[key]
        if (user.username.toLowerCase() === username.toLocaleLowerCase()) {
            if (user.password === password) {
                return done(null, user)
            }
        }
        return done(null, false, { message: 'Incorrect credentials.' })
    })
}))
// 3. serialise users
passport.serializeUser((user, done) => {
    if (users['id' + user.id]) {
        done(null, 'id' + user.id)
    } else {
        done(new Error('CANT_SERIALIZE_THIS_USER'))
    }
})
// 4. de-serialise user
passport.deserializeUser((userid, done) => {
    if (users[userid]) {
        done(null, users[userid])
    } else {
        done(new Error('THAT_USER_DOESNOT_EXIST'))
    }

})

app.get('/', function (req, res) {
    console.log(req.flash());
    res.send('<a href="/login">Login Here</a>');
});

app.get("/login", function (req, res) {

    var error = req.flash("error");

    var form = '<form action="/login" method="post">' +
        '    <div>' +
        '        <label>Username:</label>' +
        '        <input type="text" name="username"/>' +
        '    </div>' +
        '    <div>' +
        '        <label>Password:</label>' +
        '        <input type="password" name="password"/>' +
        '    </div>' +
        '    <div>' +
        '        <input type="submit" value="Log In"/>' +
        '    </div>' +
        '</form>';

    if (error && error.length) {
        form = "<b style='color: red'> " + error[0] + "</b><br/>" + form;
    }

    res.send(form);
});

app.post("/login", passport.authenticate('local', {
    successRedirect: '/members',
    failureRedirect: '/login',
    successFlash: { message: "welcome back" },
    failureFlash: true
}));


app.get("/members", authenticatedOrNot, function (req, res) {
    res.send("secret members only area!");
});


app.listen(8080);