const { server } = require('../src/server.js');
const http = require('http');

async function testRoutes() {
  const routes = [
    '/',
    '/student',
    '/student/',
    '/moderator',
    '/moderator/',
    '/display',
    '/display/',
    '/css/style.css',
    '/js/app.js',
    '/socket.io/socket.io.js'
  ];

  console.log('Testing server route availability...');
  for (const route of routes) {
    await new Promise((resolve, reject) => {
      http.get('http://localhost:3000' + route, (res) => {
        console.log(`Route ${route.padEnd(25)} => Status: ${res.statusCode}`);
        if (res.statusCode !== 200) {
          reject(new Error(`Route ${route} returned status ${res.statusCode}`));
        } else {
          resolve();
        }
      }).on('error', reject);
    });
  }

  server.close(() => {
    console.log('All Task 2.1–2.3 server routes verified successfully!');
    process.exit(0);
  });
}

setTimeout(testRoutes, 500);
