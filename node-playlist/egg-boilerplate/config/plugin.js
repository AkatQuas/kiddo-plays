'use strict';

// had enabled by egg
// exports.static = true;

// exports.next = {
  // enable: true,
  // package: '../lib/plugins/egg-nextjs',
// };

exports.sequelize = {
  enable: true,
  package: 'egg-sequelize'
}

exports.validate = {
  enable: true,
  package: 'egg-validate',
};