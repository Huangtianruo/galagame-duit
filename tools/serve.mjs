import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const directory = fileURLToPath(new URL('../site/', import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript','.js':'text/javascript','.wasm':'application/wasm','.txt':'text/plain'};
const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'HEAD' && req.method !== 'GET') {
      res.writeHead(405, {Allow:'GET, HEAD'}).end();
      return;
    }
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    const file = path.resolve(directory, '.' + (pathname === '/' ? '/index.html' : pathname));
    const relative = path.relative(directory, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      res.writeHead(403).end();
      return;
    }
    const entry = await stat(file);
    if (!entry.isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream','Content-Length':entry.size});
    if (req.method === 'HEAD') res.end();
    else await pipeline(createReadStream(file), res);
  } catch {
    if (!res.headersSent) res.writeHead(404);
    res.end();
  }
});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => {
  console.log('Duit 静态工作台 http://127.0.0.1:' + server.address().port);
});
