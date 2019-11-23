var frameModule = require('ui/frame');

exports.toAboutPage = function (args) {
    var button = args.object 
    var name = button.text
    var navigationEntry = {
        moduleName: 'views/about/about',
        transition: {
            name: name
        }
    }
    frameModule.topmost().navigate(navigationEntry);
}
exports.toProduct = _ => {
    frameModule.topmost().navigate('views/products/products')
}
exports.toObservable = _ => {
    frameModule.topmost().navigate('views/observable/observable')
}
exports.toObservableBook = _ => {
    frameModule.topmost().navigate('views/scrapbook/scrapbook');
}