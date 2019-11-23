'use strict';
const Base = require('./base');

const rulesForAdd = {
    name: 'string',
    amount: 'int',
    type: {
        type: 'int',
        convertType: 'int'
    }
}

class PrizeController extends Base {
    async list() {
        // prize list
        const { ctx } = this;
        const { success, data, message } = await ctx.service.prize.findAll();
        success ? this.success(data) : this.error(message);
    }
    async add() {
        // add a new prize
        const { ctx, app } = this;

        const errors = app.validator.validate(rulesForAdd, ctx.request.body);
        if (errors) {
            return this.paramsError(errors);
        }

        const { name, amount, type, note } = ctx.request.body;
        const { success, data, message } = await ctx.service.prize.create({
            name, amount, type, note
        });
        success ? this.success(data) : this.error(message);
    }
    async prize() {
        // pagination
        const { ctx } = this;
        const {pageNum = 1, pageSize = 10} = ctx.query;
        const {success, data, message} = await ctx.service.prize.pagination({
            pageNum, pageSize
        })
        success ? this.success(data) : this.error(message);
    }
}

module.exports = PrizeController;