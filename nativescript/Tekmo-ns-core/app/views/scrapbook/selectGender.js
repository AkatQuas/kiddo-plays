var closeCB;
var observable = require('data/observable')
var model;
var page;

exports.onLoaded = args => {
    page = args.object;
    console.log('load')
    model = new observable.fromObject({
        gender: 0
    })
    page.bindingContext = model;
}

exports.onShownModally = args => {
    console.log('shown modal')
    closeCB = args.closeCallback;
    
    model.set('genders', args.context.genders)
}

exports.onDoneTap = args => {
    var genders = model.get('genders')
    console.log(model.get('gender'))
    console.log(genders[model.gender])
    closeCB(genders[model.gender]);
}