const { downloader } = require('./htmlDownloader'),
    cheerio = require('cheerio')

const url = [
    'http://www.cnblogs.com/CraryPrimitiveMan/p/3674421.html',
    'https://cnodejs.org/topic/5203a71844e76d216a727d2e',
    'https://www.bilibili.com/','http://jandan.net/ooxx'
]

const htmlData = (err , data) => {
    if (err) {
        return console.error('finding error', err)
    }
    let $ = cheerio.load(data)

    let images = $('img')
    const urls = []
    images = images.map((index, element) => {
        urls[index] = element.attribs.src
    })
    console.log(urls)
}

url.forEach(v => {
    downloader(v, htmlData)
})