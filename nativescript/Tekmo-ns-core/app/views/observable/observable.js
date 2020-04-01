var observableModule = require('data/observable')
var viewModule = require('ui/core/view')
var page;
exports.onLoaded = args => {
    // one way binding, raw style, however you can implement this by mustache syntax
    page = args.object;

    var pet = new observableModule.Observable();

    var pet2 = new observableModule.Observable();
    // better to defined the propertyName you need in the bindingContext
    var pet3 = new observableModule.fromObject({
        header: 'Pet ScrapBook',
        footer: 'Brosteins ©2016',
        genders: ['Male', 'Female', 'Others'],
        Age:'',
        title:'default title',
        date: '',
        gender: 1

    });
    var label = viewModule.getViewById(page, 'title')

    var bindingOptions = {
        sourceProperty: 'Name',
        targetProperty: 'text'
    }
    label.bind(bindingOptions, pet)
    pet.set('Name', 'Ryan')
    pet2.set('Name', 'Ryan2')
    pet3.set('Age', 'Ryan3 age')
    pet3.genders.push('Forth')
    // page.bindingContext = pet2; // fail
    // setting the binding Context, only last one binding works
    page.bindingContext = pet3; // success
}

exports.onSave = args => {
    console.log('hh')
    var tmppate = args.object; 
    
    var scrap = page.bindingContext;
    console.log(scrap.Age);
    console.log('You have made: ' + scrap.title);
    console.log('Age: ' + scrap.date);
    console.log("Gender selected:" + scrap.genders[scrap.gender]);
}
