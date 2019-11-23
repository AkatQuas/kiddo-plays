const https = require('https'),
    cheerio = require('cheerio'),
    fs = require('fs')

const write2File = (filename, stringData ) => {
    fs.open(filename, 'w+', (err, fd) => {
            if (err) {
                if (err.code = 'EEXIST') {
                    return console.log(`${filename} is already exists`)
                }
                throw err
            }
            fs.write(fd, stringData, (err) => {
                if (err) {
                    throw err
                }
                console.log(`file ${filename} is done`)
            })
        })
}

const getStateAbbr = _ => { 
    const targetURL = 'https://en.wikipedia.org/wiki/List_of_U.S._state_abbreviations'

    const parseHTML = htmlData => {
        const $ = cheerio.load(htmlData)

        const arr = $('table.sortable tbody tr')
        let abbr = []
        for (let i = 0, j = arr.length; i < j; i++) {
            abbr[i] = $(arr[i]).children().eq(3).text()
        }
        abbr = abbr.filter(v => v)
        write2File('statesData.json', JSON.stringify(abbr)) 
    }
    https.get(targetURL, res => {
        let htmlData
        res.on('data', d => {
            htmlData += d
        })

        res.on('end', _ => {
            parseHTML(htmlData)
        })
    })
} 
