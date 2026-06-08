module.exports = {
  apps: [{
    name: 'pet-astro-server',
    script: 'server.js',
    cwd: __dirname,
    watch: false,
    max_memory_restart: '200M',
    error_file: '/tmp/petastro-pm2-error.log',
    out_file: '/tmp/petastro-pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    env: {
      PORT: 3477,
      NODE_ENV: 'production'
    }
  }]
};
