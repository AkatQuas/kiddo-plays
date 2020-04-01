module.exports = appInfo => {
    const config = exports = {};

    config.keys = '<my-security-cookie-keys>';
    config.view = {
        defaultViewEngine: 'nunjucks',
        mapping: {
            '.tpl': 'nunjucks'
        }
    };

    config.news = {
        pageSize: 5,
        serverUrl: 'https://hacker-news.firebaseio.com/v0'
    };

    config.middleware = [
        'robot',
        'errorHandler',
    ];


    config.errorHandle = {
        match: '/api',
    };
    config.robot = {
        ua: [
            /curl/i,
            /Baiduspider/i,
        ]
    };

    config.security = {
        csrf: {
            enable: false,
            ignoreJSON: true,
        }
    }

    config.cors = {
        allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH,OPTIONS',
        credentials: true
    }

    config.multipart = {
        fileSize: '2mb',
        whitelist: ['.png, .jpeg']
    };

    return config;

}