'use strict';
const Base = require('./base');

const ruleForAdd = {
    name: 'string',
    type: {
        type: 'int',
        convertType: 'int'
    }
}

class ProgramController extends Base {
    async list() {
        const { ctx } = this;
        const { success, data, message } = await ctx.service.program.findAll();
        success ? this.success(data) : this.error(message);
    }

    async add() {
        const { ctx, app } = this;

        const errors = app.validator.validate(ruleForAdd, ctx.request.body);
        if (errors) {
            return this.paramsError(errors);
        }

        const { name, type } = ctx.request.body;
        const { success, data } = await ctx.service.program.create(name, type);
        success ? this.success(data) : this.error('新增节目失败');
    }

    async typeList() {
        const { ctx } = this;
        const { data } = await ctx.service.program.typeList();
        return this.success(data)
    }

    async findFilter() {
        const { ctx } = this;
        const { name = '', type = '', check = '' } = ctx.request.query;
        const where = {
            name: { $like: `%${name}%` },
        };
        if (type) {
            where['type'] = type;
        }
        if (check) {
            where['check'] = parseInt(check, 10);
        }
        try {
            const res = await ctx.model.Program.findAll({
                raw: true,
                attributes: [
                    'id', 'name', 'company', 'type', 'check'
                ],
                where,
                order: ['id']
            });
            this.success(res);
        } catch (e) {
            this.success([]);
        }
    }
}

module.exports = ProgramController;