/*
In NativeScript, the app.js file is the entry point to your application.
You can use this file to perform app-level initialization, but the primary
purpose of the file is to pass control to the app’s first module.
*/

require("./bundle-config");
var application = require("application");
application.cssFile = './app.css';

var dateConverter = function (value, format) {
    if (!value) return '';
    var parsedDate = new Date(value);
    var result = format;

    ;[
        {
            tar: 'DD', val: parsedDate.getDate()
        },
        {
            tar: 'MM', val: parsedDate.getMonth() + 1
        },
        {
            tar: 'YYYY', val: parsedDate.getFullYear()
        }
    ].forEach(o => {
        result = result.replace(o.tar, o.val);
    });
    return result;
}

var resources = application.getResources();
resources.dateConverter = dateConverter;
resources.dateFormat = 'DD/MM/YYYY';

application.start({ moduleName: "views/home/home" });

/*
Do not place any code after the application has been started as it will not
be executed on iOS.
*/
