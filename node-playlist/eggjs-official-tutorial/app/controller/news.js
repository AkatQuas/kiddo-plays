const { Controller } = require('egg')

class NewsController extends Controller {
    async list() {
        const { ctx } = this;
        /*
        const dataList = {
            list: [
                { id: 1, title: 'this is news 1', url: '/news/1' },
                { id: 2, title: 'this is news 2', url: '/news/2' }
            ]
        }
        await ctx.render('news/list.tpl', dataList)
        */
        const page = ctx.query.page || 1;
        const newsList = await ctx.service.news.list(page);
        await ctx.render('news/list.tpl', { list: newsList })
    }
}

module.exports = NewsController;