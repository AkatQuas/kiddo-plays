var dialogsModule = require('ui/dialogs')
var page;
var fb_subject;
var fb_content;

exports.sendFeedback = _ => {
    console.log('submitting')
    fb_subject = page.getViewById('subject').text;
    fb_content = page.getViewById('content').text;

    dialogsModule.alert('Your message has been sent with Subject: ' + fb_subject + '\n and Content: ' + fb_content)
}

exports.loaded = args => {
    page = args.object;
}