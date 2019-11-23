var fileSystemService = require('~/data/fileSystemService');

var observable = require('data/observable')
var observableArray = require('data/observable-array')
var page;
var frame = require('ui/frame');

function scrapModel (id) { 
    var model = new observable.Observable();
    model.id = id;
    model.genders = ['Female', 'Male', 'Other'];
    model.calcAge = (birthDate) => {
        var now = Date.now();
        var date = new Date(birthDate)
        var diff = Math.abs(now - date) / 1000 / 31536000;

        return diff.toFixed(1);
    }
    return model
}


exports.onLoaded = args => {
    page = args.object;
    var book = new observable.fromObject({
        pages: new observableArray.ObservableArray()
    });
    var pages = fileSystemService.fileSystemService.getPages();
    if (pages.length !== 0) {
        pages.forEach(item => {
            var model = new scrapModel(item.id);

            model.title = item.title;
            model.gender = item.gender;
            model.birthDate = item.birthDate;
            model.image = item.image;
            model.lat = item.lat;
            model.long = item.long;
            model.timestamp = item.timestamp;

            book.pages.push(model);
        })
    } 
    page.bindingContext = book;
}

exports.onAddTap = args => {
    var book = page.bindingContext;
    book.pages.push(new scrapModel());
    frame.topmost().navigate({
        moduleName: 'views/scrapbook/update',
        context: { model: new scrapModel(book.pages.length) },
        backstackVisible: false
    }) 
}

exports.onItemTap = args => {
    var book = args.object.bindingContext;

    frame.topmost().navigate({
        moduleName: 'views/scrapbook/update',
        context: { model: book.pages.getItem(args.index) },
        backstackVisible: false
    })
}