const { app, mock, assert } = require('egg-mock/bootstrap')

describe('test/controller/topics.test.js', _ => {
    it('should POST /api/v2/topics/ 422', done => {
        app.mockCsrf();
        app.httpRequest()
            .post('/api/v2/topics')
            .send({
                accesstoken: '123',
            })
            .expect(422)
            .expect({
                error: 'Validation Failed',
                detail: [
                    { message: 'required', field: 'title', code: 'missing_field' },
                    { message: 'required', field: 'content', code: 'missing_field' },
                ]
            }, done)
    })
    it('shoud POST /api/v2/topics 201', done => {
        app.mockCsrf();
        app.mockService('topics', 'create', 123);
        app.httpRequest()
            .post('/api/v2/topics')
            .send({
                accesstoken: '123',
                title: 'title',
                content: 'hello'
            })
            .expect(201)
            .expect({
                topic_id: 123
            }, done)
    })
})