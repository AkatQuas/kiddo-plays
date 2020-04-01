module.exports = {
  apps: [
    {
      name: 'gateway',
      script: 'exec nginx -c $PWD/nginx.conf -p $PWD',
      cwd: 'projects/gateway',
      instances: 1,
      autorestart: true,
      watch: false,
    },
    {
      name: 'client',
      script: 'npm run start',
      instances: 1,
      autorestart: true,
      cwd: 'projects/client',
      watch: false,
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'server',
      script: 'proxychains4 npm run start:dev',
      cwd: "projects/server",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      }
    },
  ],

  deploy: {}
};
