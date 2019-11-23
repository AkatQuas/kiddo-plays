const RANKS = ['black', 'brown', 'green', 'yellow'],
    NAMESTR = 'weranmweriozxcoplmnmcbvkwepiugldfjkwaenrmwex',
    NAMESTR2 = 'mnzvkwozcnejgheruoiwerjkzvnweroiwerjwklerlkz' 

const mockNinjas = require('../data/ninja-mock'),
    mongoose = require('mongoose'),
    Ninja = require('./ninja') 

const mockNinjas = _ => {
    return new Array(100).fill(0).map(_ => {
        const nameNo = ~~(Math.random() * (NAMESTR.length - 6))
        const name = NAMESTR.substr(nameNo, 5) + ' ' + NAMESTR2.substr(nameNo, 4)
        const rank = RANKS[~~(Math.random() * RANKS.length)]
        const available = Math.random() > Math.random()
        const lng = ((Math.random() - 0.5) * 180).toFixed(3)
        const lat = ((Math.random() - 0.5) * 90).toFixed(3)
        const geometry = {
            type: 'Point',
            coordinates: [lng, lat]
        }

        return {
            name,
            rank,
            available,
            geometry
        }
    })
}

mongoose.connect('mongodb://localhost/ninjago', { useMongoClient: true })
mongoose.Promise = global.Promise

const tasks = mockData.map(v => Ninja.create(v))

Promise.all(tasks).then(_ => {
    console.log('ninja seeder done')
    mongoose.disconnect();
    process.exit(0)
}).catch(err => {
    console.log('ninja seeder fail')
    console.log(err)
    mongoose.disconnect();
    process.exit(1)
})

