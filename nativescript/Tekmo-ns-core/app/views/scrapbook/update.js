var fileSystemService = require('~/data/fileSystemService');
var observable = require('data/observable');
var frame = require('ui/frame');
var camera = require('nativescript-camera');
var image = require('image-source');
var geolocation = require('nativescript-geolocation');

var bookPage;
var page;

exports.onLoaded = args => {
    page = args.object;
    bookPage = page.navigationContext.model;
    page.bindingContext = bookPage;
}

exports.onUpdate = args => {
    fileSystemService.fileSystemService.savePage(bookPage);
    frame.topmost().goBack();
}

exports.onAddImageTap = args => {
    camera.requestPermissions();
    if (!geolocation.isEnabled()) {
        geolocation.enableLocationRequest();
    }
    camera
        .takePicture({
            width: 100,
            height: 100,
            keepAspectRatio: true
        })
        .then(pic => {
            image.fromAsset(pic).then(imgSrc => {
                bookPage.set('image', imgSrc);
            })
            geolocation.getCurrentLocation().then(loc => {
                bookPage.set('lat', loc.latitude);
                bookPage.set('long', loc.longitude);
            })
        })
}

exports.onBirthDateTap = args => {
    var modalPageModule = 'views/scrapbook/selectDate';
    var context = { birthDate: page.bindingContext.birthDate };
    var fullscreen = true;

    page.showModal(
        modalPageModule,
        context,
        function closeCallback(birthDate) {
            page.bindingContext.set('birthDate', birthDate)
        },
        fullscreen
    )
}

exports.onGenderSelect = args => {
    var modalPageModule = 'views/scrapbook/selectGender';

    var context = { genders: page.bindingContext.genders };

    var fullscreen = false;

    page.showModal(
        modalPageModule,
        context,
        function closeCallback(gender) {
            page.bindingContext.set('gender', gender);
        },
        fullscreen
    )
}