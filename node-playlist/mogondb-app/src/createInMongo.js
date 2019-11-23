const async = require('async')
const MongoClient = require('mongodb').MongoClient
const mogondb_url = 'mongodb://localhost:27017/photoapp'
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
                cb(null)
            }
        )
    },
    cb => {
        console.log("2. create albums and photos collections.\n");
        db.collection('albums', { safe: false }, cb)
    },
    (albums_obj, cb) => {
        albums_coll = albums_obj
        db.collection('photos', cb)
    },
    (photos_obj, cb) => {
        photos_coll = photos_obj
        cb(null)
    },
    cb => {
        /*
        // insert one item
        const a1 = { _id: "italy2012",
        name:"italy2012",
        title:"Spring Festival in Italy",
        date:"2012/02/15",
        description:"I went to Italy for Spring Festival."
      }
        albums_coll.insertOne(a1, cb)
        */
        const docs = [{
            _id: "italy2012",
            name: "italy2012",
            title: "Spring Festival in Italy",
            date: "2012/02/15",
            description: "I went to Italy for Spring Festival."
        },
        {
            _id: "australia2010",
            name: "australia2010",
            title: "Vacation Down Under",
            date: "2010/10/20",
            description: "Visiting some friends in Oz!"
        },
        {
            _id: "japan2010",
            name: "japan2010",
            title: "Programming in Tokyo",
            date: "2010/06/10",
            description: "I worked in Tokyo for a while."
        }];

        console.log("4. add albums.\n");
        albums_coll.insertMany(docs, cb)
    },
    (inserted_doc, cb) => {
        console.log("added albums: \n");

        var pix = [
            {
                filename: "picture_01.jpg",
                albumid: "italy2012",
                description: "rome!",
                date: "2012/02/15 16:20:40"
            },
            {
                filename: "picture_04.jpg",
                albumid: "italy2012",
                description: "fontana di trevi",
                date: "2012/02/19 16:20:40"
            },
            {
                filename: "picture_02.jpg",
                albumid: "italy2012",
                description: "it's the vatican!",
                date: "2012/02/17 16:35:04"
            },
            {
                filename: "picture_05.jpg",
                albumid: "italy2012",
                description: "rome!",
                date: "2012/02/19 16:20:40"
            },
            {
                filename: "picture_03.jpg",
                albumid: "italy2012",
                description: "spanish steps",
                date: "2012/02/18 16:20:40"
            },

            {
                filename: "photo_05.jpg",
                albumid: "japan2010",
                description: "something nice",
                date: "2010/06/14 12:21:40"
            },
            {
                filename: "photo_01.jpg",
                albumid: "japan2010",
                description: "tokyo tower!",
                date: "2010/06/11 12:20:40"
            },
            {
                filename: "photo_06.jpg",
                albumid: "japan2010",
                description: "kitty cats",
                date: "2010/06/14 12:23:40"
            },
            {
                filename: "photo_03.jpg",
                albumid: "japan2010",
                description: "shinjuku is nice",
                date: "2010/06/12 08:30:40"
            },
            {
                filename: "photo_04.jpg",
                albumid: "japan2010",
                description: "eating sushi",
                date: "2010/06/12 08:34:40"
            },
            {
                filename: "photo_02.jpg",
                albumid: "japan2010",
                description: "roppongi!",
                date: "2010/06/12 07:44:40"
            },
            {
                filename: "photo_07.jpg",
                albumid: "japan2010",
                description: "moo cow oink pig woo!!",
                date: "2010/06/15 12:55:40"
            },

            {
                filename: "photo_001.jpg",
                albumid: "australia2010",
                description: "sydney!",
                date: "2010/10/20 07:44:40"
            },
            {
                filename: "photo_002.jpg",
                albumid: "australia2010",
                description: "asdfasdf!",
                date: "2010/10/20 08:24:40"
            },
            {
                filename: "photo_003.jpg",
                albumid: "australia2010",
                description: "qwerqwr!",
                date: "2010/10/20 08:55:40"
            },
            {
                filename: "photo_004.jpg",
                albumid: "australia2010",
                description: "zzzxcv zxcv",
                date: "2010/10/21 14:29:40"
            },
            {
                filename: "photo_005.jpg",
                albumid: "australia2010",
                description: "ipuoip",
                date: "2010/10/22 19:08:40"
            },
            {
                filename: "photo_006.jpg",
                albumid: "australia2010",
                description: "asdufio",
                date: "2010/10/22 22:15:40"
            }
        ];

        console.log("5. Add pictures.\n");
        photos_coll.insertMany(pix, { safe: true }, cb);
    },
    (result, cb) => {
        console.log('Inserted all photos\n')
        photos_coll.updateOne(
            { filename: 'photo_003.jpg', albumid: 'australia2010' },
            { $set: { description: 'Change the description' } },
            cb
        )
    },
    (result, cb) => {
        console.log('update result: ', result)
        cb(null)
    }
], (err, res) => {
    if (err) {
        console.log(err)
        process.exit(1)
    } else {
        console.log('Done')
        console.log(res)
        process.exit(0)
    }
})