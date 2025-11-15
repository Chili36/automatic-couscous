module.exports = {
  apps: [
    {
      name: 'foodex2-backend',
      script: './server/index.js',
      cwd: '/Users/davidfoster/Dev/Foodex2 Code Validator',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 5001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5001
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
      merge_logs: true
    },
    {
      name: 'foodex2-frontend',
      script: 'npx',
      args: 'vite --port 5178',
      cwd: '/Users/davidfoster/Dev/Foodex2 Code Validator/client',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: '../logs/frontend-error.log',
      out_file: '../logs/frontend-out.log',
      log_file: '../logs/frontend-combined.log',
      time: true,
      merge_logs: true
    }
  ],

  deploy: {
    production: {
      user: 'node',
      host: 'localhost',
      ref: 'origin/master',
      repo: 'https://github.com/Chili36/automatic-couscous.git',
      path: '/var/www/foodex2-validator',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};