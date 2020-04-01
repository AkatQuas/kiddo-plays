const { Service } = require('egg');

class TopicService extends Service {
    constructor(ctx) {
        super(ctx);
        this.root = 'https://cnodejs.org/api/v1';
    }
    async create(params) {
        const result = await this.ctx.curl(`${this.root}/topics`, {
            method: 'POST',
            data: params,
            dataType: 'json',
            contentType: 'json'
        })
        this.checkSuccess(result);
        return result.data.topic_id;
    }

    checkSuccess(result) {
        if(result.status !== 200) {
            const errorMsg = result.data && result.data.error_msg ? result.data.error_msg : 'unknown error';
            this.ctx.throw(result.status, errorMsg);
        } 
        if(!result.data.success) {
            this.ctx.throw(500, 'remote reponse error', { data: result.data })
        }
    }
}

module.exports = TopicService;