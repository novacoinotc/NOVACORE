module.exports = {
  apps: [{
    name: 'novacorp',
    script: './start-server.sh',
    cwd: '/home/ubuntu/NOVACORE',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
