const { Service } = require('egg')

class UserService extends Service {
    async find(uid) {
        const { ctx } = this;
        // const user = await ctx.db.query('select * from user where uid = ?', uid)
        const user = await ctx.curl(`https://httpbin.org/get?uid=${uid}`, {
            dataType: 'json'
        })
        const avatar = await this.getPicturue(uid)
        return {
            user: user.data,
            avatar
        }
    }

    async getPicturue(uid) {
        const { ctx } = this;
        // const res = await ctx.curl(`http://remote.com/uid=${uid}`, { dataType: 'json'})
        const res = await ctx.curl('https://httpbin.org/post', {
            // method is required
            method: 'POST',
            // telling HttpClient to send data as JSON by contentType
            contentType: 'json',
            data: {
                userid: uid,
                hello: 'world',
                now: Date.now(),
            },
            // telling HttpClient to process the return body as JSON format explicitly
            dataType: 'json',
        });
        return res.data;
    }
}
module.exports = UserService;