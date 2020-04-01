const { app, mock, assert } = require('egg-mock/bootstrap');

describe('test on middleware/robot.test.js', _ => {
    it('shoule block robot', done => {
        app.httpRequest()
            .get('/')
            .set('User-Agent', 'Baiduspider')
            .expect(403, done)
    })
})