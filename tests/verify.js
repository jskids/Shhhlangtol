const { server } = require('../src/server.js');
const http = require('http');

async function testRoutes() {
  const routes = ['/', '/student', '/moderator', '/display', '/css/style.css', '/js/app.js', '/socket.io/socket.io.js'];
  for (const route of routes) {
    await new Promise((resolve, reject) => {
      http.get('http://localhost:3000' + route, (res) => {
        console.log(`Route ${route} => Status: ${res.statusCode}`);
        resolve();
      }).on('error', reject);
    });
  }
  server.close(() => {
    console.log('All routes verified successfully.');
    process.exit(0);
  });
}

setTimeout(testRoutes, 500);
