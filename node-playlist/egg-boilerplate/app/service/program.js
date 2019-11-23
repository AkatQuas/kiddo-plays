'use strict';

const { Service } = require('egg');
const modelResult = require('../utils/model-result');

const _enum = {
    0: '其他',
    1: '歌舞类',
    2: '语言类',
}
const typeList = Object.keys(_enum).map(key => ({
    key,
    value: _enum[key]
}))
const formatItem = item => ({ ...item, type: _enum[item.type] || '其他' })

class ProgramService extends Service {
    async findAll() {
        const { ctx, app } = this;
        try {
            const sequelize = app.Sequelize;
            const raw = await ctx.model.Program.findAll({
                raw: true,
                where: [
                    sequelize.where(
                        // filter by char_length
                        sequelize.fn('CHAR_LENGTH', sequelize.col('name')),
                        { $gte: 6, $lte: 18 },
                    ),
                    {
                        // filter by array
                        company: {
                            $in: []
                        }
                    }
                ],
                attributes: {
                    exclude: ['create_time', 'update_time']
                }
            });
            return modelResult.success(raw.map(formatItem));
        } catch (e) {
            return modelResult.error('failed to fetch program list')
        }
    }
    async create(name, type) {
        const { ctx } = this;
        try {
            await ctx.model.Program.create({ name, type })
            return modelResult.emptySuccess()
        } catch (e) {
            return modelResult.error('failed to add a new program');
        }
    }

    typeList() {
        return modelResult.success(typeList)
    }
}

module.exports = ProgramService;
