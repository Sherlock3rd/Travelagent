import test from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../scripts/server.mjs';

test('服务可用且不暴露仓库文件', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const home = await fetch(base);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Travelagent/);
    for (const path of ['/vendor/maplibre/maplibre-gl.mjs', '/vendor/maplibre/maplibre-gl-worker.mjs', '/vendor/maplibre/maplibre-gl-shared.mjs']) {
      const module = await fetch(base + path);
      assert.equal(module.status, 200, path);
      assert.match(module.headers.get('content-type'), /text\/javascript/, path);
      await module.arrayBuffer();
    }
    const health = await (await fetch(`${base}/healthz`)).json();
    assert.equal(health.service, 'travelagent');
    assert.equal(health.pid, process.pid);
    for (const path of ['/AGENTS.md', '/.git/config', '/private/passport.pdf', '/scripts/server.mjs', '/%2e%2e%2fpackage.json', '/..%5cpackage.json']) {
      assert.equal((await fetch(`${base}${path}`)).status, 404, path);
    }
    assert.equal((await fetch(`${base}/%ZZ`)).status, 400);
    assert.equal((await fetch(base, { method: 'POST' })).status, 405);
    assert.equal(await (await fetch(base, { method: 'HEAD' })).text(), '');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
