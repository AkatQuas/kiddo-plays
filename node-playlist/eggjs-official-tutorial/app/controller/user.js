const Controller = require('egg').Controller;

const rules = {
    username: {
        type: 'email',
    },
    password: {
        type: 'password',
        compare: '123123123'
    }
}
class UserController extends Controller {
    async login() {
        const { ctx, logger } = this;
        try {
            ctx.validate(rules)
            ctx.createSuccess({
                result: true
            })
        } catch (e) {
            const { errors } = e;
            logger.error(errors)
            const message = errors.map(i => i.field).join(',') + ' incorrect!'
            ctx.createError(422, message)
        }
    }
    async findById () {
        const { ctx } = this;
        const userId = ctx.params.id;
        const userInfo = await ctx.service.user.find(userId) 
        ctx.createSuccess(userInfo)
    }

}

module.exports = UserController;