const { Subscription } = require('egg')

class Timer extends Subscription {
    static get schedule() {
        return {
            interval: 1000,
            // cron: '0 0 */3 * * * ',

            /*
            *    *    *    *    *    *
            ┬    ┬    ┬    ┬    ┬    ┬
            │    │    │    │    │    |
            │    │    │    │    │    └ day of week (0 - 7) (0 or 7 is Sun)
            │    │    │    │    └───── month (1 - 12)
            │    │    │    └────────── day of month (1 - 31)
            │    │    └─────────────── hour (0 - 23)
            │    └──────────────────── minute (0 - 59)
            └───────────────────────── second (0 - 59, optional)
            */
            type: 'all'
        }
    }

    async subscribe() {
        const { logger } = this;
        // logger.info('timer here')
    }
    async task() {

    }

}

module.exports = Timer;