const async = require('async')
const MongoClient = require('mongodb').MongoClient
const mogondb_url = 'mongodb://localhost:27017/photoapp'
const logStars = _ => { console.log('\n*****\n') }
let db, albums_coll, photos_coll
async.waterfall([
    cb => {
        console.log("1. ------- connect --\n");
        MongoClient.connect(
            mogondb_url,
            {
                poolSize: 100,
                w: 1,
            },
            (err, dbase) => {
                if (err) {
                    console.log('bad')
                    console.log(err)
                    process.exit(-1)
                }
                console.log("Connected correctly to server\n");
                db = dbase
                db.collections(cb)
            }
        )
    },
    (all_colls, cb) => {
        console.log('the collections are listed here\n')
        console.log(all_colls)
        logStars()
        db.collection('albums', cb)
    },
    (one_coll, cb) => {
        console.log('albums result: \n', one_coll)
        logStars()
        const cursor = one_coll.find({ name: { $regex: /2010$/ } })
        /*
            {key: {
                $ne:'',
                $lt:'',
                $lte:'',
                $gt:''
                $gte:'',
                $in:[],
                $nin:[],
                $all:[],
                $and: [ {}, {} ],
                $or: [ {}, {} ]
            }}

            const cursor = db.collection('inventory').find({ 
                status: "A",
                $or: [ { qty: { $lt: 30 } }, { item: { $regex: "^p" } } ]
            });

            const cursor = db.collection('photos').find({}).sort({}).skip(3).limit(5)
        */
        /* 
        let i =0
        cursor.each((err, item) => {
            console.log(++i)
            if (err) {
                cb(err)
            } else if (!item) {
                cb(null)
            } else {
                console.log(item)
            }
        })
        */
        let i = 0
        cursor.on('data', doc => {
            console.log(++i)
            console.log(doc)
            logStars()
        })

        cursor.on('error', cb)

        cursor.on('end', _ => {
            cb(null)
        })
    }
], (err, res) => {
    if (err) {
        console.log(err)
        process.exit(1)
    } else {
        console.log('Done')
        console.log('res is: ', res)
        process.exit(0)
    }
})