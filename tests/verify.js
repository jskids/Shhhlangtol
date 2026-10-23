const { server } = require('../src/server.js');
const http = require('http');

async function testRoutesAndSockets() {
  const validRoutes = [
    '/',
    '/student',
    '/student/',
    '/moderator',
    '/moderator/',
    '/display',
    '/display/',
    '/health',
    '/css/style.css',
    '/js/app.js',
    '/socket.io/socket.io.js'
  ];

  console.log('Testing server valid HTTP routes and health check...');
  for (const route of validRoutes) {
    await new Promise((resolve, reject) => {
      http.get('http://localhost:3000' + route, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          console.log(`Route ${route.padEnd(25)} => Status: ${res.statusCode}`);
          if (res.statusCode !== 200) {
            reject(new Error(`Route ${route} returned status ${res.statusCode}`));
          } else if (route === '/health') {
            try {
              const json = JSON.parse(body);
              if (json.status === 'ok') {
                console.log('   Health check JSON payload verified:', JSON.stringify(json));
              } else {
                reject(new Error(`Health payload status was not ok: ${body}`));
              }
            } catch (err) {
              reject(err);
            }
          }
          resolve();
        });
      }).on('error', reject);
    });
  }

  console.log('Testing 404 handler for unknown routes...');
  await new Promise((resolve, reject) => {
    http.get('http://localhost:3000/unknown-route-404-test', (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        console.log(`Unknown Route /unknown-route-404-test => Status: ${res.statusCode}`);
        if (res.statusCode === 404) {
          try {
            const json = JSON.parse(body);
            if (json.error === 'Not Found') {
              console.log('   404 JSON response payload verified:', JSON.stringify(json));
              resolve();
            } else {
              reject(new Error(`404 response payload missing 'Not Found': ${body}`));
            }
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error(`Expected 404 status but got ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });

  server.close(() => {
    console.log('All Task 2.7–2.9 verification tests completed successfully!');
    process.exit(0);
  });
}

setTimeout(testRoutesAndSockets, 500);
