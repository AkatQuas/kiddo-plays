module.exports = {
  apps: [{
    name: 'server',
    script: 'npm run start:dev',

    instances: 1,
    autorestart: true,
    cwd: './',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }],

  deploy: {
  }
};
