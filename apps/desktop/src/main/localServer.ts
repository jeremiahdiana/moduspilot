import http from 'http';
import fs from 'fs';
import path from 'path';

// Firebase Auth's popup flow validates window.location.protocol (must be
// http/https/chrome-extension) and checks the origin against the project's
// Authorized domains list — file:// satisfies neither. `localhost` is
// authorized by default on every Firebase project, so serving the bridge
// page over a local HTTP server (instead of loadFile) is the standard fix
// for using Firebase Auth popup/redirect flows inside Electron.
export function startLocalServer(): Promise<number> {
  const htmlPath = path.join(__dirname, '../../src/bridge/index.html');

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(htmlPath, (err, data) => {
          if (err) {
            res.writeHead(500);
            res.end('failed to load index.html');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(data);
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.on('error', reject);
    // Port 0 = OS picks a free port; binding explicitly to localhost (not 0.0.0.0)
    // keeps this off the network, reachable only from this machine.
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        resolve(address.port);
      } else {
        reject(new Error('Failed to determine local server port'));
      }
    });
  });
}
