// Keep Leaflet interactions/route overlays; use vector tiles only for the basemap.
let runtime;
const attribution = '<a href="https://openfreemap.org/">OpenFreeMap</a> · &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> · &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
export function createMap(id) {
  const map = L.map(id, {
    scrollWheelZoom: true, touchZoom: true, doubleClickZoom: true,
    worldCopyJump: false, minZoom: 2, maxZoom: 18,
    maxBounds: [[-85, -180], [85, 180]], maxBoundsViscosity: 1,
    zoomControl: false
  });
  L.control.zoom({ zoomInTitle: '放大地图', zoomOutTitle: '缩小地图' }).addTo(map);
  map.getContainer().setAttribute('aria-description', '鼠标滚轮缩放；手机双指缩放，单指拖动；也可使用放大和缩小按钮。');
  return map;
}
export function addBasemap(target) {
  let vector, timer, disposed = false, fallback = false;
  const container = target.getContainer();
  const status = document.createElement('div');
  status.className = 'basemap-status';
  status.setAttribute('role', 'status');
  status.textContent = '中文底图加载中…';
  container.after(status);
  const raster = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18, minZoom: 2, noWrap: true,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  function useFallback() {
    if (disposed || fallback) return;
    fallback = true; clearTimeout(timer);
    if (vector && target.hasLayer(vector)) target.removeLayer(vector);
    raster.addTo(target);
    status.textContent = '中文底图暂不可用，已切换原文底图；缩放与行程标记仍可使用。';
  }
  raster.on('tileerror', () => { status.textContent = '部分底图未加载；可继续缩放、查看站点和行程。'; });
  target.once('unload', () => { disposed = true; clearTimeout(timer); status.remove(); });
  timer = setTimeout(useFallback, 20000);
  (async () => {
    try {
      runtime ||= (async () => {
        window.maplibregl = await import('./vendor/maplibre/maplibre-gl.mjs');
        await import('./vendor/maplibre/leaflet-maplibre-gl.js');
      })();
      await runtime;
      if (disposed || fallback) return;
      vector = L.maplibreGL({
        style: new URL('./map-style-zh.json', import.meta.url).href,
        localIdeographFontFamily: 'sans-serif',
        attributionControl: { customAttribution: attribution }
      }).addTo(target);
      const gl = vector.getMaplibreMap();
      gl.once('load', () => {
        if (disposed || fallback) return;
        clearTimeout(timer);
        status.textContent = '中文优先 · 无中文译名时显示原名';
      });
      gl.on('error', () => {
        if (!disposed && !fallback) status.textContent = '部分中文底图加载失败；可稍后刷新，站点与缩放仍可使用。';
      });
    } catch { useFallback(); }
  })();
}
