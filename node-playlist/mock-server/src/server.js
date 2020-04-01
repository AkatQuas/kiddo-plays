const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const bodyParser = require('body-parser');

const api = require('./api');

const app = express();
app.use(cors());
app.use(morgan('dev'));
// app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.set('PORT', process.env.PORT || 8090);

app.use('/api', api);

app.listen(app.get('PORT'), _ => {
    console.log(`listening at port: ${app.get('PORT')}`);
});
