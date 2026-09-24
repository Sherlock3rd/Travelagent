import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = await realpath(resolve(root, 'public'));
const workspaceId = createHash('sha256').update(root.toLowerCase()).digest('hex').slice(0, 16);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
const isInside = (path) => {
  const rel = relative(publicRoot, path);
  return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`);
};

export const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org https://dohahamadairport.com https://betamedia.experienceegypt.eg; connect-src 'self' https://router.project-osrm.org https://tiles.openfreemap.org; worker-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  const send = (status, body, type = 'text/plain; charset=utf-8') => {
    res.writeHead(status, { 'Content-Type': type });
    res.end(req.method === 'HEAD' ? undefined : body);
  };
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    return send(405, 'Method not allowed');
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { return send(400, 'Bad request'); }
  if (pathname === '/healthz') {
    return send(200, JSON.stringify({ service: 'travelagent', status: 'ok', workspaceId, pid: process.pid }), types['.json']);
  }
  if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.'))) return send(404, 'Not found');
  const candidate = resolve(publicRoot, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!isInside(candidate)) return send(404, 'Not found');
  try {
    const path = await realpath(candidate);
    if (!isInside(path) || !(await stat(path)).isFile()) return send(404, 'Not found');
    const body = await readFile(path);
    return send(200, body, types[extname(path)] || 'application/octet-stream');
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) return send(404, 'Not found');
    console.error(error);
    return send(500, 'Internal server error');
  }
});

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8788);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 必须是 1–65535 的整数');
  const host = process.env.HOST || '127.0.0.1';
  server.on('error', error => { console.error(`服务启动失败：${error.message}`); process.exitCode = 1; });
  server.listen(port, host, () => console.log(`Travelagent: http://${host}:${port} | root=${root} | pid=${process.pid}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}
