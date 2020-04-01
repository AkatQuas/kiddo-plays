const { Service } = require('egg');

class NewsService extends Service {
    async list (page = 1) {
        const { ctx } = this;
        const { serverUrl, pageSize } = this.config.news;
        const { data: idList } = await ctx.curl(`${serverUrl}/topstories.json`, {
            data: {
                orderBy: '"$key"',
                startAt: `"${pageSize * (page -1)}`,
                endAt: `"${pageSize * page - 1}`
            },
            dataType: 'json',
        })
        const newsList = await Promise.all(
            Object.keys(idList).map(key => {
                const url = `${serverUrl}/item/${idList[key]}.json`;
                return ctx.curl(url, {dataType: 'json'})
            })
        )
        return newsList.map(res => res.data);
    }
}

module.exports = NewsService;

/*
module.exports = app => {
    return class NewsService extends app.Service {}
}
*/