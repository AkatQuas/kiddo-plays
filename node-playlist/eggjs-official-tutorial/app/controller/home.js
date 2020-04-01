const Controller = require('egg').Controller;

class HomeController extends Controller {
    async index() {
        const { ctx, logger } = this;
        // console.log(ctx.helper)
        ctx.helper.index();
        logger.info('in fo from logger')
        logger.debug()
        
        ctx.body = 'Hello world!';
    }

}

module.exports = HomeController;

/*
module.exports = app => {
    return class HomeController extends app.Controller {

    }
}
*/