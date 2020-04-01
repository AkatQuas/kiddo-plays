'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app;

  // prize
  router.get('/api/prize', controller.prize.list)
  router.post('/api/prize', controller.prize.add)

  // program
  router.get('/api/program', controller.program.list)
  router.post('/api/program', controller.program.add)
  router.get('/api/program-type', controller.program.typeList)

  
};