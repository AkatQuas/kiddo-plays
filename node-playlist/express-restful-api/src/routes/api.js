const express = require('express');
const router = express.Router();
const Ninja = require('../models/ninja');

router.get('/ninjas', (req, res, next) => {
    // Ninja.find({}).then(list => {
    //     res.send(JSON.stringify(list))
    // })
    Ninja.geoNear(
        {
            type: 'Point',
            coordinates: [parseFloat(req.query.lng), parseFloat(req.query.lat)]
        },
        { maxDistance: 100000, spherical: true }
    ).then(ninjas => {
        res.json(ninjas)
    }).catch(next) 
});

router.get('/ninjas/recommend', (req, res, next) => {
    Ninja.find({}).then(ninjas => {
        res.json(ninjas)
    }).catch(next)
})


router.post('/ninjas', (req, res, next) => {
    // create would return a promise, the parameters is the data affected 
    Ninja.create(req.body).then(ninja => {
        res.json(ninja)
    }).catch(next)
});

router.put('/ninjas/:id', (req, res, next) => {
    Ninja.findByIdAndUpdate({ _id: req.params.id }, req.body).then(_ => {
        Ninja.findById({ _id: req.params.id }).then(ninja => {
            res.json(ninja)
        })
    }).catch(next)
});

router.delete('/ninjas/:id', (req, res, next) => {
    Ninja.findByIdAndRemove({ _id: req.params.id }).then(ninja => {
        res.json(ninja)
    }).catch(next)
});

module.exports = router;
