const cowsay = require('cowsay');
const { message } = require('../messages');
console.log(
  cowsay.say({
    text: message,
  })
);
