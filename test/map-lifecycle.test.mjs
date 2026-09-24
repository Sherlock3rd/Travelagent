import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('离开小地图后已排队的 resize 和 moveend 不访问被销毁的地图', async () => {
  let definition, pending;
  const L = {
    Layer: { extend(options) { definition = options; return function Layer() {}; } },
    Util: { requestAnimFrame(callback, context) { pending = () => callback.call(context); } }
  };
  const source = await readFile(new URL('../public/vendor/maplibre/leaflet-maplibre-gl.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, { L, maplibregl: {} });
  const layer = { _map: {}, _glMap: {} };
  definition._transitionEnd.call(layer);
  layer._map = null; layer._glMap = null;
  assert.doesNotThrow(pending);
  assert.doesNotThrow(() => definition._zoomEnd.call(layer));
});
