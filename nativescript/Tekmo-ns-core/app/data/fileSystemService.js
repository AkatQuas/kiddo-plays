var fileSystem = require('file-system');
var imageModule = require('image-source');

var fileSystemService = function () {
    this.file = fileSystem.knownFolders.documents().getFile('scrapbook.json');
}

fileSystemService.prototype.getPages = function () {
    var pages = [];
    if (this.file.readTextSync().length !== 0) {
        pages = JSON.parse(this.file.readTextSync());
    }
    pages.forEach(page => {
        if (page.imageBase64 != null) {
            page.image = imageModule.fromBase64(page.imageBase64);
        }
    })
    return pages;
}

fileSystemService.prototype.savePage = function (scrapbookPage) {
    var pages = this.getPages();

    var index = pages.findIndex(el => {
        return el.id === scrapbookPage.id
    })
    var newPage = {
        id: scrapbookPage.id,
        title: scrapbookPage.title,
        imageBase64: scrapbookPage.image !== null ? scrapbookPage.image.toBase64String('png') : null,
        gender: scrapbookPage.gender,
        birthDate: scrapbookPage.birthDate,
        lat: scrapbookPage.lat,
        long: scrapbookPage.long,
        timestamp: new Date().toString()
    }
    if (index !== -1) {
        pages[index] = newPage;
    } else {
        pages.push(newPage)
    }

    var json = JSON.stringify(pages);
    this.file.writeText(json);
}

exports.fileSystemService = new fileSystemService()