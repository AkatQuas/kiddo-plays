const express = require('express');

const router = express.Router();

const file_data = name => require(`./data/${name}.json`);

const {
    trimArray,
    oneFromArray
} = require('./utils');

router.get('/gift', (req,res) => {
    res.json(file_data('gifts'))
});

router.get('/holder', (req, res) => {
    res.json(file_data('file_data'));
});

router.get('/profile', (req, res) => {
    res.json({
        has_child: Math.random() > .5,
        id: ~~(Math.random() * 100),
        username: 'fe-mock'
    });
});

router.get('/dbservers', (req, res) => res.json({ dbservers: file_data('dbservers') }));

router.get('/dbservers/:serverid/databases', (req, res) => {
    const databases = trimArray(file_data('databases')).map(o => ({
        db_id: o.id,
        description: o.dialect,
        name: o.name
    }));
    res.json({
        databases
    });
});

router.get('/tables', (req, res) => {
    /*
        req.query = {
            db_id: 80,
        }
     */
    res.json({
        tables: trimArray(file_data('tables'), 6, 6)
    });
});

router.get('/table', (req, res) => {
    const fields = trimArray(file_data('fields')).map(o => ({...o, defaults: null, extra: 'null'}));
    res.json({
        fields
    });
});

router.get('/workorders', (req, res) => {
    const all = file_data('workorders');
    const { action } = req.query;
    const workorders = trimArray(all.filter(one => one.action === action), 5, 2);

    res.json({workorders});
});

router.get('/workorders/:id', (req, res) => {
    const content = oneFromArray(file_data('sql-statement'));
    const initiator = oneFromArray(file_data('initiators'));
    const order = oneFromArray(file_data('workorders'));
    const review_comments = trimArray(file_data('review-comments'), 3, 0);

    res.json({
        your_id: req.body.id,
        ...order,
        content,
        initiator,
        review_comments
    });

});

router.post('/log', (req, res) => {
    console.log(JSON.stringify(req.body));
    res.json({
        result: 'ok'
    })
})
module.exports = router;
