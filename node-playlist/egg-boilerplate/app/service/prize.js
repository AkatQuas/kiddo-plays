'use strict';

const { Service } = require('egg');
const modelResult = require('../utils/model-result');

class PrizeService extends Service {
    async findAll() {
        const { ctx } = this;
        try {
            const raw = await ctx.model.Prize.findAll({
                raw: true,
                attributes: {
                    exclude: ['create_time', 'update_time']
                }
            })
            return modelResult.success(raw);
        } catch (e) {
            return modelResult.error('failed to fetch the prize list')
        }
    }
    async create({ name, amount, type, note }) {
        const { ctx } = this;
        try {
            await ctx.model.Prize.create({
                name, amount, type, note
            })
            return modelResult.emptySuccess()
        } catch (e) {
            return modelResult.error('failed to add a new prize');
        }
    }
    async test2() {
        const { ctx } = this;
        try {
            const raw = await ctx.model.Prize.findAll({
                attributes: ['id', 'name_cn', 'name_en', 'owner_id', 'updater_id', 'operation_manager_id', 'update_time'],
                where: {
                    $or: [
                        {
                            name_cn: {
                                $like: `%${name}%`,
                            },
                        },
                        {
                            name_en: {
                                $like: `%${name}%`,
                            },
                        },
                    ],
                    soft_delete: 0,
                },
                offset: (name - 1) * 15,
                limit: 15,
                order: [
                    ['update_time', 'DESC'],
                ],
            })
            return modelResult.success(raw)
        } catch (e) {
            return modelResult.error('查询失败')
        }
    }
    async pagination({ pageNum, pageSize }) {
        const { ctx } = this;
        pageNum = pageNum * 1;
        pageSize = pageSize * 1;
        try {
            // add other where condition or 
            const raw = await ctx.model.prize.findAndCountAll({
                where: {
                    $and: [
                        {
                            id: {
                                $gt: 694
                            }
                        },
                        {
                            name: {
                                $like: 'N%'
                            }
                        }
                    ]
                },
                attributes: {
                    exclude: ['create_time', 'update_time']
                },
                offset: (pageNum - 1) * pageSize,
                limit: pageSize,
                order: [
                    ['id', 'desc']
                ]
            });

            return modelResult.pagination({ ...raw, pageNum, pageSize })
        } catch (e) {
            return modelResult.error('分页查询失败');
        }
    }
}

module.exports = PrizeService;
