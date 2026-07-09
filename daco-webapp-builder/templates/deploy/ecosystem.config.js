module.exports = {
  apps: [
    {
      name: '{APP_NAME}',
      script: 'node_modules/next/dist/bin/next', // Next.js runner path relative to cwd
      args: 'start',
      cwd: 'frontend',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: {PORT}
      },
      error_file: './logs/frontend-err.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: '{APP_NAME}-backend',
      script: 'server.js',
      cwd: 'server',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: {BACKEND_PORT}
      },
      error_file: './logs/backend-err.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
