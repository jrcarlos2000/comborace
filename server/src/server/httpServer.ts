import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import type { Config } from '../config.js';
import { log } from '../log.js';
import { WsHub } from './wsHub.js';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.map': 'application/json; charset=utf-8',
};

function contentType(file: string): string {
  return MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

// Resolve a URL path to a file inside staticDir, blocking traversal outside the root and
// falling back to index.html so the client-side SPA routes resolve.
function resolveStatic(staticDir: string, urlPath: string): string | null {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const candidate = path.normalize(path.join(staticDir, clean));
  if (!candidate.startsWith(staticDir)) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  const index = path.join(staticDir, 'index.html');
  return fs.existsSync(index) ? index : null;
}

export interface RunningServer {
  hub: WsHub;
  close: () => Promise<void>;
}

export function startHttpServer(config: Config): RunningServer {
  const hub = new WsHub();
  const hasStatic = fs.existsSync(config.staticDir);
  if (!hasStatic) {
    log.warn(`static dir not found: ${config.staticDir} (build the app: cd app && npm run build). WS still serves.`);
  }

  const server = http.createServer((req, res) => {
    const url = req.url ?? '/';
    if (url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, clients: hub.size }));
      return;
    }
    if (!hasStatic) {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('app not built; run: cd app && npm run build');
      return;
    }
    const file = resolveStatic(config.staticDir, url);
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType(file) });
    fs.createReadStream(file).pipe(res);
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    if ((req.url ?? '').split('?')[0] !== config.wsPath) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => hub.add(ws));
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      log.error(`port ${config.port} is in use; set PORT=<free port> or stop the other process`);
    } else {
      log.error('http server error', err);
    }
    process.exit(1);
  });

  server.listen(config.port, config.host, () => {
    log.info(`http listening on http://${config.host}:${config.port} (ws ${config.wsPath})`);
  });

  return {
    hub,
    close: () =>
      new Promise<void>((resolve) => {
        wss.close();
        server.close(() => resolve());
      }),
  };
}
