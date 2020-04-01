'use strict';

const { Service } = require('egg');
const modelResult = require('../utils/model-result');

class _Service extends Service {
    async findAll() {
        const { ctx } = this;
        try {

            return modelResult.success();
        } catch (e) {
            return modelResult.error('数据库操作失败')
        }
    }
}

module.exports = _Service;
