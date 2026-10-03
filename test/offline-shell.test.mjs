import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('previously opened itinerary shell and trip JSON reopen without network', async () => {
  const listeners = new Map();
  const entries = new Map();
  const origin = 'https://example.github.io';
  const scope = origin + '/Travelagent/';
  let offline = false;
  const keyFor = key => new URL(String(key)).pathname;
  const cache = {
    async addAll(paths) {
      for (const path of paths) entries.set(keyFor(new URL(path, scope)), new Response(path));
    },
    async put(key, value) { entries.set(keyFor(key), value); },
    async match(key) { return entries.get(keyFor(key)); }
  };
  const caches = {
    async open() { return cache; },
    async keys() { return ['travelagent-offline-old', 'travelagent-offline-__BUILD_REVISION__']; },
    async delete(name) { assert.equal(name, 'travelagent-offline-old'); return true; },
    async match(key) { return cache.match(key); }
  };
  const self = {
    location: { origin },
    registration: { scope },
    clients: { async claim() {} },
    async skipWaiting() {},
    addEventListener(name, fn) { listeners.set(name, fn); }
  };
  const context = { self, caches, URL, Response, fetch: async request => {
    if (offline) throw Error('offline');
    return new Response(new URL(request.url).pathname);
  }};
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), context);
  async function run(name, request) {
    let promise;
    const event = {
      request,
      waitUntil(p) { promise = p; },
      respondWith(p) { promise = p; }
    };
    listeners.get(name)(event);
    await promise;
    return promise;
  }
  await run('install');
  await run('activate');
  assert.ok(entries.has('/Travelagent/index.html'));
  assert.ok(entries.has('/Travelagent/published-trip.json'));
  offline = true;
  const page = await run('fetch', { method: 'GET', mode: 'navigate', url: scope + '#itinerary' });
  assert.equal(await page.text(), './index.html');
  const script = await run('fetch', { method: 'GET', mode: 'same-origin', url: scope + 'app.js?v=abc' });
  assert.equal(await script.text(), './app.js');
  const trip = await run('fetch', { method: 'GET', mode: 'same-origin', url: scope + 'published-trip.json' });
  assert.equal(await trip.text(), './published-trip.json');
});

