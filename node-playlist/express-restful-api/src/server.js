const express = require('express');
const bodyParser = require('body-parser')
const mongoose = require('mongoose');

const app = express();

mongoose.connect('mongodb://localhost/ninjago', { useMongoClient: true });
mongoose.Promise = global.Promise;

app.use(express.static(__dirname+ '/../public'))
//middleware before api 
app.use(bodyParser.json());

//api hanlder
app.use('/api', require('./routes/api'));

//middleware before res.end()
app.use((err,req,res,next) => {
    console.log(err)
    res.status(422).send({error: err._message})
})

const port = process.env.port || 4040;

app.listen(port, _ => {
    console.log('listening to port: ' + port);
});

