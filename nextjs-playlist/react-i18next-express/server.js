const express = require('express')
const path = require('path')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev })
const handle = app.getRequestHandler()

const i18nextMiddleware = require('i18next-express-middleware')
const Backend = require('i18next-node-fs-backend')
const { i18nInstance } = require('./i18n')

i18nInstance
    .use(Backend)
    .use(i18nextMiddleware.LanguageDetector)
    .init({
        fallbackLng: 'en',
        preload: ['en', 'cn'], // preload all languages
        ns: [ 'common', 'home', 'about', 'activity'], // required, preload all the name spaces
        backend: {
            loadPath: path.resolve(__dirname, './locales/{{lng}}/{{ns}}.json'),
            addPath: path.resolve(__dirname, './locales/{{lng}}/{{ns}}.missing.json')
        }
    }, _ => {
        app.prepare()
            .then(_ => {
                const server = express();

                // enable middleware for i18next
                server.use(i18nextMiddleware.handle(i18nInstance))

                // serve locales for the client
                server.use('/locales', express.static(path.resolve(__dirname, './locales')))

                // missing keys 
                server.post('/locales/add/:lng/:ns', i18nextMiddleware.missingKeyHandler(i18nInstance))

                // use next.js
                server.get('*', (req, res) => handle(req, res))

                server.listen(3030, err => {
                    if (err) throw err;
                    console.log('> Ready on http://localhost:3030')
                })

            })
    })