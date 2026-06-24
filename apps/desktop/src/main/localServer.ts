import http from 'http';
import fs from 'fs';
import path from 'path';
import log from 'electron-log';

// Firebase Auth's popup flow validates window.location.protocol (must be
// http/https/chrome-extension) and checks the origin against the project's
// Authorized domains list — file:// satisfies neither. `localhost` is
// authorized by default on every Firebase project, so serving the bridge
// page over a local HTTP server (instead of loadFile) is the standard fix
// for using Firebase Auth popup/redirect flows inside Electron.
//
// CRITICAL: the port must be STABLE across launches. Firebase Auth persists
// the signed-in session in IndexedDB, which is partitioned by *origin*
// (scheme + host + port). A random port (listen(0)) changes the origin every
// launch — `http://localhost:54321` vs `http://localhost:62000` — orphaning
// the persisted session so the user has to sign in again every time. A fixed
// port keeps the origin constant so the session restores. We try a small
// deterministic list of uncommon ports and use the first that binds, so the
// origin stays stable in the overwhelmingly common case (preferred port free).
const CANDIDATE_PORTS = [47615, 47616, 47617, 47618, 47619];

function tryListen(server: http.Server, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const onError = (err: NodeJS.ErrnoException) => {
      server.removeListener('error', onError);
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        // A non-collision error (permissions, etc.) — surface it by rejecting
        // the outer promise via a thrown error on the next candidate exhaustion.
        log.error(`[bridge] local server error on port ${port}`, err);
        resolve(false);
      }
    };
    server.once('error', onError);
    // Bind explicitly to localhost (not 0.0.0.0) so it's off the network,
    // reachable only from this machine.
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', onError);
      resolve(true);
    });
  });
}

export async function startLocalServer(): Promise<number> {
  const htmlPath = path.join(__dirname, '../../src/bridge/index.html');

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

  for (const port of CANDIDATE_PORTS) {
    // eslint-disable-next-line no-await-in-loop
    if (await tryListen(server, port)) {
      return port;
    }
  }

  throw new Error(
    `Failed to bind the local auth server to any candidate port (${CANDIDATE_PORTS.join(', ')})`
  );
}
