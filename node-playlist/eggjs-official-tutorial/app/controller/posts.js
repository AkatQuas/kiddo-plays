const { Controller } = require('egg')

/*
// using resources

Method -> Path -> Route Name -> Controller.Action

GET -> /posts -> posts -> app.controllers.posts.index

GET -> /posts/new -> new_post -> app.controllers.posts.new

GET -> /posts/:id -> post -> app.controllers.posts.show

GET -> /posts/:id/edit -> edit_post -> app.controllers.posts.edit

POST -> /posts -> posts -> app.controllers.posts.create

PATCH -> /posts/:id -> post -> app.controllers.posts.update

DELETE -> /posts/:id -> post -> app.controllers.posts.destroy
*/

class PostsController extends Controller {
    async index() {
        const { ctx } = this;
        ctx.body =  'index get'
    }
    async new () {
        const { ctx } = this;
        ctx.body =  'new get'
    }
    async show () {
        const { ctx } = this;
        ctx.body =  `show get with id ${ctx.params.id}`
    }
    async edit () {
        const { ctx } = this;
        ctx.body =  `edit get with id ${ctx.params.id}`
    }
    async create () {
        const { ctx } = this;
        ctx.body =  'create post'
    }
    async update () {
        const { ctx } = this;
        ctx.body =  `update patch with id ${ctx.params.id}`
    }
    async destroy () {
        const { ctx } = this;
        ctx.body =  `destroy delete with id ${ctx.params.id}`
    }
    async new () {
        const { ctx } = this;
        ctx.body =  'new get'
    }
}

module.exports = PostsController;