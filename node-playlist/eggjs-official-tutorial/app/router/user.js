module.exports = app => {
    const { router, controller } = app;
    router.get('/user/:id', controller.user.findById)
    router.post('/login', controller.user.login);
}