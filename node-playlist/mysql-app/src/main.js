const mysql = require('mysql'),
    async = require('async')

const host = '192.168.1.7',
    database = 'photoalbums',
    user = 'root',
    password = 'root'

let dbpool;

async.waterfall([
    cb => {
        console.log("\n** 1. create connection.");
        dbpool = mysql.createPool({
            connectionLimit: 200,
            host,
            user,
            password,
            database
        })
        cb(null)
    },
    cb => {
        console.log("\n** 2. insert into albums.");
        // dbpool.query(SQL, values, (err, results, fields) => {})
        dbpool.query(
            'INSERT INTO albums VALUES (?,?,?,?)',
            ['italy2012', 'spring festival', '2012-02-15', 'i went to italy for fun'],
            cb
        )
    },
    (results, fields, cb) => {
        console.log(results)
        console.log(fields)
        console.log("\n** 2b. insert into albums again.");
        dbpool.query(
            "INSERT INTO albums VALUES (?, ?, ?, ?)",
            ["australia2010", "Vacation Down Under", "2010-10-20",
                "Spent some time in Australia visiting Friends"],
            cb);
    },
    (results, fields, cb) => {
        console.log("\n** 2c. insert into albums again.");
        dbpool.query(
            "INSERT INTO albums VALUES (?, ?, ?, ?)",
            ["japan2010", "Programming in Tokyo", "2010/06/10",
                "I worked in Tokyo for a while."],
            cb);
    },
    (results, fields, cb) => {
        const q = `INSERT INTO Photos (filename, album_name, description, date) VALUES (?,?,?,?)`
        const pix = [
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
                date: "2010/06/12 08:40:40"
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
        // INSERT MANY
        async.forEachSeries(
            pix,
            (item, callbk) => {
                dbpool.query(q, [item.filename, item.albumid, item.description, item.date], callbk)
            },
            cb
        )
    },
    cb => {
        // UPDATE
        dbpool.query(
            'UPDATE photos SET description = ? WHERE album_name = ? AND filename = ? ',
            ['aha', 'australia2010', 'photo_006.jpg'],
            cb
        )
    },
    (results, fields, cb) => {
        // DELETE WITH LIKE QUERY
        dbpool.query(
            'DELETE FROM photos WHERE album_name =? AND filename LINK ?',
            ['australia2010', '%01%'],
            cb
        )
    },
    (results, fields, cb) => {
        dbpool.query('SELECT * FROM albums', [], cb)
    },
    (rows, fields, cb) => {
        rows.forEach(v => {
            console.log(JSON.stringify(v))
        })
        cb(null)
    },
    cb => {
        // SELECT UNDER CONDITION ADN ORDER AND LIMIT
        const q = 'SELECT * FROM photos WHERE album_name = ? ORDER BY date ASC, filename ASC, LIMIT ? ,? '
        dbpool.query(q, ['japan2010', 3, 3], cb)
    },
    (rows, fields, cb) => {
        rows.forEach(v => {
            console.log(JSON.stringify(v))
        })
        cb(null)
    },
], (err, res) => {
    if (err) {
        console.log(err)
    } else {
        console.log(res)
    }
    dbpool.end()
    process.exit(0)
})
