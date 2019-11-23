module.exports = app => {
    const { router, controller } = app;
    router.get('/', controller.home.index);
    router.get('/news', controller.news.list);

    // Mapping the 'topics' resource's CRUD interfaces to the app/controller/topics.js using app.resources
    router.resources('topics', '/api/v2/topics', controller.topics);
    router.post('/img-upload', controller.imgUpload.index);

    router.resources('posts', '/posts', controller.posts);

    require('./router/user')(app);
}

/*
downsize the app/router.js
// app/router.js
module.exports = app => {
    require('./router/news')(app);
    require('./router/admin')(app);
};

// app/router/news.js
module.exports = app => {
    app.router.get('/news/list', app.controller.news.list);
    app.router.get('/news/detail', app.controller.news.detail);
};

// app/router/admin.js
module.exports = app => {
    app.router.get('/admin/user', app.controller.admin.user);
    app.router.get('/admin/log', app.controller.admin.log);
};
*/