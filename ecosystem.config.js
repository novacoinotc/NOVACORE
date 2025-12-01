module.exports = {
  apps: [{
    name: 'novacore',
    script: './start-server.sh',
    cwd: '/home/ubuntu/NOVACORE',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
