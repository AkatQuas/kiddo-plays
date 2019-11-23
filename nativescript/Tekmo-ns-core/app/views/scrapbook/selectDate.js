var closeCallback;
var observableModule = require('data/observable');
var model;
var page;

exports.onLoaded = args => {
    page = args.object;
    model = new observableModule.fromObject({
        date: new Date(Date.now())
    }) 

    page.bindingContext = model;
}

exports.onShownModally = args => {
    closeCallback = args.closeCallback;
    if (args.context.birthDate) {
        model.set('date', args.context.birthDate);
    }
}

exports.onDoneTap = args => {
    closeCallback(model.date);
}