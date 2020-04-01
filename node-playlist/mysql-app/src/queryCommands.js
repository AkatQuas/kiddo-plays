const mysql = require('mysql'),
    async = require('async')

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


const manipulateData = _ => {
    let dbPool
    async.waterfall([
        cb => {
            dbPool = mysql.createPool({
                connectionLimit: 10,
                host, user, password, database
            })
            cb(null)
        },
        cb => {
            dbPool.query('SHOW COLUMNS from customers', [], cb)
        },
        (results, fields, cb) => {
            logStars('show all columns')
            console.log(results)
            dbPool.query('SELECT city,zip FROM customers', [], cb)
        },
        (results, fields, cb) => {
            logStars('select columns: city and zip')
            console.log(results)
            dbPool.query('SELECT name,city FROM customers ORDER BY id,zip ASC', [], cb)
        },
        (results, fields, cb) => {
            logStars('select columns: name and city ordered by id then zip ASC')
            console.log(results)
            dbPool.query('SELECT id,name FROM customers ORDER BY id DESC LIMIT 2, 5', [], cb)
        },
        (results, fields, cb) => {
            logStars('select columns: id,name ordered by id in DESC with limit beginning from 2 with length of 5')
            console.log(results)
            dbPool.query('SELECT name,city FROM customers WHERE id < 6', [], cb)
        },
        (results, fields, cb) => {
            logStars('select name,city from with filter, id < 6')
            console.log(results)
            dbPool.query('SELECT name,state FROM customers WHERE state NOT IN ("PW","CA")', [], cb)
        },
        (results, fields, cb) => {
            logStars('SELECT name,city with filter, state NOT in ["PW","CA"]')
            console.log(results)
            dbPool.query('SELECT name,city FROM customers WHERE name LIKE "B%"', [], cb)
        },
        (results, fields, cb) => {
            logStars('SELECT name,city with fuzzy search, name LIKE "B"')
            console.log(results)
            dbPool.query('SELECT name,city FROM customers WHERE name REGEXP "br|de" ', [], cb)
        },
        (results, fields, cb) => {
            logStars('SELECT name,city FROM customers WHERE name REGEXP "br|de"')
            console.log(results)
            dbPool.query('SELECT CONCAT(city,"-",state) AS new_address FROM customers', [], cb)
        },
        (results, fields, cb) => {
            logStars('SELECT CONCAT(city,"-",state) AS new_address FROM customers')
            console.log(results)
            dbPool.query('SELECT zip AS old_zip, zip-1 AS new_zip FROM customers', [], cb)
        },
        (results, fields, cb) => {
            logStars('SELECT zip AS old_zip, zip-1 AS new_zip FROM customers')
            console.log(results)
            dbPool.query('SELECT UPPER(name) FROM customers', [], cb)
        },
        (results, fields, cb) => {
            logStars('SELECT UPPER(name) FROM customers')
            console.log(results)
            dbPool.query('SELECT SUM(id) FROM customers', [], cb)
        },
        (results, fields, cb) => {
            logStars('SELECT SUM(id) FROM customers')
            console.log(results)
            dbPool.query('SELECT SUM(account), COUNT(*) as item_count, name FROM customers GROUP BY name HAVING SUM(account) > 2000', [], cb)
        },
        (results, fields, cb) => {
            logStars('SELECT SUM(account), COUNT(*) as item_count, name FROM customers GROUP BY name HAVING SUM(account) > 2000 ')
            console.log(results)
            dbPool.query('SELECT id, name,account FROM customers WHERE account > (SELECT AVG(account) FROM customers) ORDER BY account', [], cb)
        },
        (results, fields, cb) => {
            logStars('SELECT id, name,account FROM customers WHERE account > (SELECT AVG(account) FROM customers) ORDER BY account')
            console.log(results)
            logStars('!! JOINT TABLES !!')
            dbPool.query('SELECT customers.id, customers.name, items.name,items.cost FROM customers, items WHERE customers.id = items.seller_id ORDER BY customers.id', [], cb)
        },
        (results, fields, cb) => {
            logStars('SELECT customers.id, customers.name, items.name,items.cost FROM customers, items WHERE customers.id = items.seller_id ORDER BY customers.id')
            console.log(results)
            dbPool.query('SELECT customers.name as c_name, items.name as i_name FROM customers LEFT OUTER JOIN items ON customers.id = items.seller_id ORDER BY customers.id', [], cb)
        },
        (results, fields, cb) => {
            logStars('SELECT customers.name as c_name, items.name AS i_name FROM customers LEFT OUTER JOIN items ON customers.id = seller_id ORDER BY customers.id')
            console.log(results)
            dbPool.query('INSERT INTO items(name, cost , seller_id) VALUES (?,?,?)', ['kinggang',876,17], cb)
        },
        (results, fields, cb) => {
            logStars('INSERT INTO items(name, cost , seller_id) VALUES ("kinggang",876, 17)')
            console.log(results)
            dbPool.query('INSERT INTO items(name, cost , seller_id) VALUES (?,?,?), (?,?,?)', ['kingyuio',876,17, 'dinggang',888,12], cb)
        },
        (results, fields, cb) => {
            logStars('INSERT INTO items(name, cost , seller_id) VALUES ("kinggang",876, 17), ("dinggang",888,12)')
            console.log(results)
            dbPool.query('UPDATE items SET cost = ? WHERE name = ?', [99999,'dinggang'], cb)
        },
        (results, fields, cb) => {
            logStars('UPDATE items SET cost = 99999 WHERE name = dinggang')
            console.log(results)
            // dbPool.query('SELECT name,city FROM customers WHERE name REGEXP "" ',[],cb)
            cb(null, 'fine')
        }
    ], finalCB)
}

manipulateData()
