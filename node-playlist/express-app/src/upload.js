const express = require('express'),
    morgan = require('morgan'),
    multer = require('multer')

const app = express()

app.use(morgan('dev'))

const upload = multer({ dest: 'uploads/' })

app.post('/uploadtest', upload.single('file_to_upload'), (req, res) => {
    console.log(JSON.stringify(req.body, 0, 2))
    res.end(JSON.stringify(req.file, 0, 2) + ' is done.\n')
})
// using curl to upload file by creating a form data

// curl -i -H 'Expect:' --form 'file_to_upload=@test.txt' --form file_info=hello http://localhost:9090/uploadtest

app.post('/body', (req, res) => {
    res.end(JSON.stringify(req.body, 0, 2) + '\n')
})

app.get('*', (req, res) => {
    res.end('You are doomed on *')
})

app.listen(9190)
