const fs = require('fs')
const path = require('path')
const createApp = require('./app')
const server = require('express')()
const vsr = require('vue-server-renderer');
const renderer = vsr.createRenderer({
    template: fs.readFileSync(path.resolve(__dirname, 'views/index.template.html'),'utf-8')
});

server.get('*', (req, res) => {
    const context = { url: req.url }

    const app = createApp(context)

    renderer.renderToString(app, (err,html) => {
        if (err) {
            res.status(500).end('Interal Server Error')
            return;
        }
        res.end(html)
    })
})

server.listen(8080, _ => {
    console.log('> listening at http://localhost:8080')
})