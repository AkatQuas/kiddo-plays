const mysql = require('mysql'),
    async = require('async')

const { USERS, SELLINGITEMS } = require('./data')

const { logError, logSuccess, logStars } = require('./utils')

const host = '192.168.1.7',
    database = 'youtube',
    user = 'root',
    password = 'root'

const finalCB = (err, results) => {
    if (err) {
        logError()
        console.log(err)
    } else {
        logSuccess()
        console.log(results)
    }
    process.exit(0)
}

const insertData = _ => {
    let dbPool
    async.waterfall([
        cb => {
            console.log('\n ** 1. create pool')
            dbPool = mysql.createPool({
                connectionLimit: 10,
                host, user, password, database
            })
            cb(null)
        },
        cb => {
            console.log('\n** 2. inserting the user')
            async.forEachSeries(
                USERS,
                (item, callbk) => {
                    dbPool.query(
                        'INSERT INTO Customers(name, address, city, state,zip,account) VALUES (?,?,?,?,?,?)',
                        [item.name, item.address, item.city, item.state, item.zip, item.account],
                        callbk
                    )
                },
                cb
            ) 
        },
        cb => {
            console.log('\n** 3. inserting the sellingitems')
            async.forEachSeries(
                SELLINGITEMS,
                (item, callbk) => {
                    dbPool.query(
                        'INSERT INTO items(name,cost,seller_id) VALUES (?,?,?)',
                        [item.name, item.cost, item.seller_id],
                        callbk
                    )
                },
                cb
            ) 
        },
        cb => {
            cb(null, 'hello')
        }
    ], finalCB)
}

console.log('The function is commented for safety')
// insertData()
