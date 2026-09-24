import { STORAGE_KEY, COLORS, CATEGORIES, MODES, GUIDE_CATEGORIES, blankState, validateState, routeSignature, dayForSave } from './model.js';
import { createMap, addBasemap } from './map.js';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const empty = (title, detail) => '<div class="empty-state"><strong>' + esc(title) + '</strong>' + esc(detail) + '</div>';
const uuid = () => crypto.randomUUID();
const color = index => COLORS[index % COLORS.length];
const routeName = day => day.stops.map(s => s.name).join(' → ');
const stamp = () => new Date().toISOString();
const formatTime = date => { const d = new Date(date); return Number.isFinite(d.getTime()) ? d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '时间未知'; };
let state = blankState(), lastSaved = null, writable = true, filter = 'all', selectedDay = null, toastTimer, editorSave, picker = null, pickerMarker = null, draftStops = [], pinIndex = null, editorBaseline = null;
try {
  lastSaved = localStorage.getItem(STORAGE_KEY);
  if (lastSaved) state = validateState(JSON.parse(lastSaved));
} catch {
  writable = false;
  const warning = document.createElement('p');
  warning.className = 'storage-warning';
  warning.textContent = '本机数据暂时无法读取。为保护原数据，已暂停保存；请先导出备份，不要清除浏览器数据。';
  $('#main').prepend(warning);
}
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => $('#toast').hidden = true, 4200); }
function commit(mutate, message = '已保存到此浏览器') {
  if (!writable) { toast('当前无法保存，请先导出备份。'); return false; }
  try {
    if (localStorage.getItem(STORAGE_KEY) !== lastSaved) throw new Error('另一个页面已修改内容，请刷新后重试，避免覆盖。');
    const next = structuredClone(state);
    mutate(next);
    next.revision = state.revision + 1;
    const valid = validateState(next);
    const serialized = JSON.stringify(valid);
    localStorage.setItem(STORAGE_KEY, serialized);
    state = valid; lastSaved = serialized;
    render();
    $('#save-state').textContent = '已保存到此浏览器';
    if (message) toast(message);
    return true;
  } catch (error) {
    const message = error.name === 'QuotaExceededError' ? '浏览器空间不足，保存失败；请导出备份。' : error.message;
    if ($('#editor').open) $('#editor-error').textContent = message;
    toast(message); return false;
  }
}
function confirmAction(message) {
  $('#confirm-message').textContent = message;
  const dialog = $('#confirm-dialog');
  dialog.showModal();
  return new Promise(resolve => {
    const finish = result => { dialog.close(); $('#confirm-ok').onclick = null; $('#confirm-cancel').onclick = null; dialog.oncancel = null; resolve(result); };
    $('#confirm-ok').onclick = () => finish(true);
    $('#confirm-cancel').onclick = () => finish(false);
    dialog.oncancel = event => { event.preventDefault(); finish(false); };
  });
}
let map, layers;
try {
  map = createMap('map').setView([27, 30], 2);
  addBasemap(map); layers = L.layerGroup().addTo(map);
} catch { $('#map-network').hidden = false; $('#map-network').textContent = '地图暂时不可用，其余旅行内容仍可编辑。'; }
function drawMap() {
  if (!map) return;
  layers.clearLayers();
  let pointsCount = 0;
  state.days.forEach((day, index) => {
    const located = day.stops.filter(s => s.point);
    pointsCount += located.length;
    const points = day.road?.points || day.stops.map(s => s.point);
    const routeColor = color(index);
    const opacity = selectedDay && selectedDay !== day.id ? .25 : .9;
    // Missing intermediate stops must break the line rather than connect across them.
    let segment = [];
    const segments = [];
    points.forEach(point => { if (point) segment.push(point); else { if (segment.length > 1) segments.push(segment); segment = []; } });
    if (segment.length > 1) segments.push(segment);
    segments.forEach(path => {
      L.polyline(path, { color: routeColor, weight: selectedDay === day.id ? 5 : 3, opacity, dashArray: day.road ? null : '7 8' }).addTo(layers).on('click', () => selectRoute(day.id));
      const step = Math.max(1, Math.floor((path.length - 1) / 5));
      for (let i = step; i < path.length; i += step) {
        const a = map.project(path[i - 1]), b = map.project(path[i]);
        if (a.distanceTo(b) < .1) continue;
        const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        L.marker(path[i], { interactive: false, icon: L.divIcon({ className: 'direction-marker', iconSize: [18, 18], iconAnchor: [9, 9], html: '<span style="color:' + routeColor + ';opacity:' + opacity + ';transform:rotate(' + angle + 'deg)">➤</span>' }) }).addTo(layers);
      }
    });
    day.stops.forEach((stop, si) => {
      if (!stop.point) return;
      L.circleMarker(stop.point, { radius: 5, color: routeColor, fillColor: '#fffefa', fillOpacity: 1, weight: 2, opacity }).addTo(layers)
        .bindTooltip(esc('D' + (index + 1) + ' · ' + (si + 1) + ' ' + stop.name), { permanent: selectedDay === day.id, direction: 'top', className: 'map-label' });
    });
  });
  $('#map-empty').hidden = pointsCount > 0;
  const mapAction = $('#map-empty button');
  if (state.days.length) { delete mapAction.dataset.addDay; mapAction.dataset.editDay = state.days[0].id; mapAction.textContent = '标记行程位置 →'; }
  else { delete mapAction.dataset.editDay; mapAction.dataset.addDay = ''; mapAction.textContent = '添加第一天 →'; }
}
function fitMap(day) {
  if (!map) return;
  const days = day ? [day] : state.days;
  const points = days.flatMap(d => d.road?.points || d.stops.map(s => s.point).filter(Boolean));
  if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 13 });
  else if (day) toast('这一天还未标记地图位置。编辑行程后可逐站定位。');
}
function selectRoute(id) { selectedDay = id; renderRoutes(); drawMap(); fitMap(state.days.find(d => d.id === id)); }
function renderRoutes() {
  $('#route-count').textContent = state.days.length + ' DAYS';
  $('#route-list').innerHTML = state.days.length ? state.days.map((d, i) => '<button class="route-item ' + (selectedDay === d.id ? 'selected' : '') + '" data-route="' + d.id + '" aria-pressed="' + (selectedDay === d.id) + '"><span class="day-badge" style="--day-color:' + color(i) + '">D' + (i + 1) + '</span><span><strong>' + esc(routeName(d)) + '</strong><small>' + (d.road ? (d.road.distance / 1000).toFixed(1) + ' km · 公路估算' : d.stops.every(s => s.point) ? '站点连线 · 待规划道路' : '地图位置待补充') + '</small></span></button>').join('') : '<div class="route-empty">从一份日程开始，<br>慢慢描绘旅行的轮廓。</div>';
}
function renderDays() {
  const visible = state.days.filter(d => filter === 'all' || d.status === 'confirmed');
  $('#itinerary-count').textContent = visible.length ? visible.length + ' 天安排' : filter === 'confirmed' ? '尚无已确认行程' : '还没有安排';
  $('#days').innerHTML = visible.length ? visible.map(d => {
    const index = state.days.indexOf(d);
    const roadHint = d.road ? '<div class="day-detail">公路估算 ' + (d.road.distance / 1000).toFixed(1) + ' km · ' + Math.round(d.road.duration / 60) + ' 分钟（不含停留）</div>' : '';
    return '<article class="day-card ' + d.status + '" style="--day-color:' + color(index) + '"><div><div class="day-number">D' + (index + 1) + '</div><div class="day-date">' + esc(d.date || '日期待定') + '</div></div><div><div class="day-route">' + esc(routeName(d)) + '</div><div class="day-detail"><span>' + esc(d.mode) + '</span><span>' + esc(d.departure || '出发待定') + ' — ' + esc(d.arrival || '到达待定') + '</span><span>时长：' + esc(d.duration || '待补充') + '</span></div>' + roadHint + (d.note ? '<p class="day-description">' + esc(d.note) + '</p>' : '') + (d.source ? '<div class="day-detail">确认依据：' + esc(d.source) + '</div>' : '') + '<button class="text-button route-action" data-show-map="' + d.id + '">在地图上查看 ↗</button>' + (['自驾', '大巴'].includes(d.mode) ? ' <button class="text-button route-action" data-road="' + d.id + '">' + (d.road ? '更新公路估算' : '计算公路路线') + '</button>' : '') + '</div><div class="day-lodging"><span class="label">当晚住在</span><strong>' + esc(d.lodging || '住宿待补充') + '</strong><div class="day-detail"><span class="status ' + d.lodgingStatus + '">' + (d.lodgingStatus === 'confirmed' ? '住宿已确认' : '住宿待确认') + '</span></div></div><div class="day-controls"><span class="status ' + d.status + '">' + (d.status === 'confirmed' ? '✓ 行程已确认' : '行程待确认') + '</span><div class="day-buttons"><button class="text-button" data-edit-day="' + d.id + '">编辑</button><button class="text-button" data-delete-day="' + d.id + '">删除</button></div><div class="day-buttons"><button class="text-button" aria-label="提前 D' + (index + 1) + '" data-move-day="' + d.id + '" data-direction="-1"' + (index === 0 ? ' disabled' : '') + '>↑</button><button class="text-button" aria-label="后移 D' + (index + 1) + '" data-move-day="' + d.id + '" data-direction="1"' + (index === state.days.length - 1 ? ' disabled' : '') + '>↓</button></div></div></article>';
  }).join('') : empty(filter === 'confirmed' ? '把确定的安排，留在这里' : '旅行还没有开始，计划可以先走一步', filter === 'confirmed' ? '编辑日程并明确选择“已确认”后，将在这里显示。' : '添加第一天，记录出发地、目的地、住宿和大致时长。');
}
function renderPacking() {
  const done = state.packing.filter(p => p.done).length;
  $('#pack-count').textContent = done + '/' + state.packing.length;
  $('#packing-progress-label').textContent = done + ' / ' + state.packing.length;
  $('#packing-progress').style.width = (state.packing.length ? done / state.packing.length * 100 : 0) + '%';
  $('#packing-list').innerHTML = state.packing.length ? CATEGORIES.map(category => {
    const entries = state.packing.filter(p => p.category === category);
    return entries.length ? '<div class="packing-group"><h3>' + category + '</h3>' + entries.map(p => '<div class="packing-item ' + (p.done ? 'done' : '') + '"><label><input type="checkbox" data-check="' + p.id + '"' + (p.done ? ' checked' : '') + '><span>' + esc(p.name) + '</span></label><button class="icon-button" data-delete-packing="' + p.id + '" aria-label="删除 ' + esc(p.name) + '">×</button></div>').join('') + '</div>' : '';
  }).join('') : empty('行囊不必很满，重要的别忘记', '添加要带的物品，准备好一件，就勾选一件。');
}
function renderNotes() {
  $('#note-list').innerHTML = state.notes.length ? [...state.notes].reverse().map(n => '<article class="note-card"><div class="note-meta"><strong>' + esc(n.author || '旅行者') + '</strong><span>' + esc(formatTime(n.createdAt)) + '</span><button class="icon-button" data-delete-note="' + n.id + '" aria-label="删除留言">×</button></div><p class="note-body">' + esc(n.body) + '</p></article>').join('') : empty('留点空间，给路上的灵感', '提醒、想法和待办，都可以记在这里。');
}
function renderGuides() {
  $('#guide-list').innerHTML = state.guides.length ? state.guides.map(g => '<article class="panel guide-card"><div class="guide-top"><span class="guide-category">' + esc(g.category) + '</span><div><button class="text-button" data-edit-guide="' + g.id + '">编辑</button> <button class="icon-button" data-delete-guide="' + g.id + '" aria-label="删除攻略">×</button></div></div><h3>' + esc(g.title) + '</h3><p class="guide-body">' + esc(g.body) + '</p><div class="guide-source">' + (g.url ? '<a href="' + esc(g.url) + '" target="_blank" rel="noopener noreferrer">查看信息来源 ↗</a>' : '<span>来源待补充</span>') + '<span>' + (g.checkedDate ? '核验于 ' + esc(g.checkedDate) : '尚未核验') + '</span></div></article>').join('') : empty('把有用的信息，收进旅行口袋', '收藏交通方式、餐厅、预约要求或当地提醒，记录来源与核验日期。');
}
function render() {
  $('#trip-title').textContent = state.trip.title;
  document.title = state.trip.title + ' · Travelagent';
  $('#trip-subtitle').textContent = [state.trip.destination, state.trip.startDate && (state.trip.startDate + (state.trip.endDate ? ' — ' + state.trip.endDate : ' 出发'))].filter(Boolean).join(' / ') || '目的地与日期待补充，让计划从这里开始。';
  $('#day-count').textContent = String(state.days.length).padStart(2, '0');
  $('#confirmed-count').textContent = String(state.days.filter(d => d.status === 'confirmed').length).padStart(2, '0');
  renderRoutes(); renderDays(); renderPacking(); renderNotes(); renderGuides(); drawMap();
}
const field = (name, label, value = '', type = 'text', full = false, required = false, max = 200) => '<label class="field' + (full ? ' full' : '') + '">' + label + '<input name="' + name + '" type="' + type + '" value="' + esc(value) + '"' + (required ? ' required' : '') + ' maxlength="' + max + '"></label>';
const select = (name, label, options, value) => '<label class="field">' + label + '<select name="' + name + '">' + options.map(o => { const key = Array.isArray(o) ? o[0] : o, text = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(key) + '"' + (key === value ? ' selected' : '') + '>' + esc(text) + '</option>'; }).join('') + '</select></label>';
const textArea = (name, label, value, max = 4000) => '<label class="field full">' + label + '<textarea name="' + name + '" rows="3" maxlength="' + max + '">' + esc(value) + '</textarea></label>';
const statusOptions = [['pending', '待确认'], ['confirmed', '已确认']];
function openEditor(title, html, save) {
  if (picker) { picker.remove(); picker = null; }
  pinIndex = null; pickerMarker = null;
  editorBaseline = lastSaved;
  $('#editor-title').textContent = title; $('#editor-content').innerHTML = html; $('#editor-error').textContent = '';
  editorSave = save; $('#editor').showModal();
}
function closeEditor() { $('#editor').close(); if (picker) { picker.remove(); picker = null; } }
$('#editor-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    if (lastSaved !== editorBaseline) throw new Error('编辑期间内容已在其他页面更新，请关闭后重新编辑。');
    if (editorSave(new FormData(event.currentTarget))) closeEditor();
  } catch (error) { $('#editor-error').textContent = error.message; }
});
$('#close-editor').onclick = closeEditor; $('#cancel-editor').onclick = closeEditor;
$('#editor').addEventListener('close', () => { if (picker) { picker.remove(); picker = null; } });
$('#edit-trip').onclick = () => openEditor('这次旅行', '<div class="form-grid">' + field('title', '旅行名称', state.trip.title, 'text', true, true, 80) + field('destination', '目的地', state.trip.destination, 'text', true, false, 120) + field('startDate', '出发日期', state.trip.startDate, 'date') + field('endDate', '结束日期', state.trip.endDate, 'date') + '</div>', form => commit(s => { s.trip = Object.fromEntries(form); }));
function renderStops() {
  $('#stop-list').innerHTML = draftStops.map((s, i) => '<div class="stop-row"><span>' + (i + 1) + '</span><input data-stop-name="' + i + '" aria-label="站点 ' + (i + 1) + ' 名称" placeholder="' + (i === 0 ? '出发地' : i === draftStops.length - 1 ? '目的地' : '途经地') + '" value="' + esc(s.name) + '" required maxlength="120"><button type="button" class="pin-button ' + (s.point ? 'located' : '') + '" data-pin="' + i + '">' + (s.point ? '✓ 已定位' : '地图定位') + '</button><button type="button" class="icon-button" data-remove-stop="' + i + '" aria-label="移除站点 ' + (i + 1) + '"' + (draftStops.length <= 2 ? ' disabled' : '') + '>×</button></div>').join('');
}
function editDay(id) {
  const original = state.days.find(d => d.id === id);
  const d = original || { id: uuid(), date: '', stops: [{ name: '', point: null }, { name: '', point: null }], mode: '待定', departure: '', arrival: '', duration: '', lodging: '', lodgingStatus: 'pending', status: 'pending', note: '', source: '', road: null };
  draftStops = structuredClone(d.stops);
  openEditor(original ? '编辑 D' + (state.days.indexOf(original) + 1) + ' 行程' : '添加第 ' + (state.days.length + 1) + ' 天', (original?.status === 'confirmed' || original?.lodgingStatus === 'confirmed' ? '<p class="warning-note">这天已有确认记录。保存前请重新核实行程与住宿的确认状态，避免沿用旧安排的确认结果。</p>' : '') + '<div class="form-grid">' + field('date', '行程日期（可稍后补充）', d.date, 'date') + select('status', '行程确认状态', statusOptions, 'pending') + '</div><p class="form-hint">按出行顺序添加站点；地图定位可稍后补充，不影响保存日程。</p><div id="stop-list" class="stop-list"></div><button type="button" id="add-stop" class="text-button">＋ 增加途经地</button><div id="picker-container" hidden><p class="picker-instruction" id="picker-instruction"></p><div id="picker-map"></div><button type="button" id="clear-pin" class="text-button">清除此站地图位置</button></div><div class="form-grid" style="margin-top:20px">' + select('mode', '主要交通方式', MODES, d.mode) + field('duration', '大致时长（如车程 2 小时）', d.duration, 'text', false, false, 80) + field('departure', '出发时间（当地时间）', d.departure, 'time') + field('arrival', '到达时间（当地时间）', d.arrival, 'time') + field('lodging', '当晚住宿地点 / 酒店', d.lodging, 'text', true) + select('lodgingStatus', '住宿确认状态', statusOptions, 'pending') + field('source', '确认依据（订单/资料说明，选填）', d.source, 'text', true, false, 500) + textArea('note', '当天安排与备注', d.note) + '</div>', form => {
    const updated = dayForSave(original, { id: d.id, ...Object.fromEntries(form), stops: structuredClone(draftStops), road: null });
    return commit(s => { const index = s.days.findIndex(x => x.id === d.id); if (index < 0) s.days.push(updated); else s.days[index] = updated; });
  });
  renderStops();
}
function pinStop(index) {
  pinIndex = index;
  $('#picker-container').hidden = false;
  $('#picker-instruction').textContent = '正在标记「' + (draftStops[index].name || '站点 ' + (index + 1)) + '」：拖动、缩放地图，然后点击准确位置。';
  if (!window.L) { toast('地图未加载，位置可稍后补充。'); return; }
  if (!picker) {
    picker = createMap('picker-map').setView(map?.getCenter() || [27, 30], Math.max(3, map?.getZoom() || 3));
    addBasemap(picker);
    picker.on('click', event => {
      if (pinIndex === null || !draftStops[pinIndex]) return;
      const { lat, lng } = event.latlng.wrap();
      draftStops[pinIndex].point = [Number(lat.toFixed(6)), Number(lng.toFixed(6))];
      if (pickerMarker) picker.removeLayer(pickerMarker);
      pickerMarker = L.circleMarker([lat, lng], { color: '#365443', radius: 7 }).addTo(picker);
      renderStops();
      $('#picker-instruction').textContent = '已标记「' + (draftStops[pinIndex].name || '站点 ' + (pinIndex + 1)) + '」。保存行程后生效，也可再次点击调整。';
    });
  }
  setTimeout(() => { picker?.invalidateSize(); if (draftStops[index]?.point) { picker?.setView(draftStops[index].point, 12); if (pickerMarker) picker?.removeLayer(pickerMarker); pickerMarker = L.circleMarker(draftStops[index].point, { color: '#365443', radius: 7 }).addTo(picker); } }, 50);
}
function editGuide(id) {
  const g = state.guides.find(g => g.id === id) || { id: uuid(), title: '', category: '交通出行', body: '', url: '', checkedDate: '' };
  openEditor(id ? '编辑攻略' : '收下一条实用攻略', '<div class="form-grid">' + field('title', '标题', g.title, 'text', true, true, 120) + select('category', '分类', GUIDE_CATEGORIES, g.category) + field('checkedDate', '核验日期（未核验则留空）', g.checkedDate, 'date') + textArea('body', '攻略内容', g.body, 8000) + field('url', '信息来源链接（选填）', g.url, 'url', true, false, 2000) + '</div>', form => commit(s => { const record = { id: g.id, ...Object.fromEntries(form) }; const index = s.guides.findIndex(x => x.id === g.id); if (index < 0) s.guides.push(record); else s.guides[index] = record; }));
}
let routing = false, lastRouteTime = 0;
async function calculateRoad(id) {
  const day = state.days.find(d => d.id === id);
  if (!day || !day.stops.every(s => s.point)) { toast('请先在编辑行程中定位所有站点，再计算公路路线。'); return; }
  if (routing || Date.now() - lastRouteTime < 1500) { toast('正在计算，请稍候。'); return; }
  routing = true; lastRouteTime = Date.now();
  const signature = routeSignature(day);
  toast('正在计算公路路线，预计需几秒……');
  try {
    const coords = day.stops.map(s => s.point[1] + ',' + s.point[0]).join(';');
    const response = await fetch('https://router.project-osrm.org/route/v1/driving/' + coords + '?overview=simplified&geometries=geojson&steps=false', { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('服务暂不可用');
    const result = await response.json();
    if (result.code !== 'Ok' || !result.routes?.length) throw new Error('未找到可用道路');
    const r = result.routes[0];
    if (commit(s => {
      const current = s.days.find(d => d.id === id);
      if (!current || routeSignature(current) !== signature) throw new Error('计算期间站点已改变，请重新计算。');
      current.road = { signature, points: r.geometry.coordinates.map(p => [p[1], p[0]]), distance: r.distance, duration: r.duration, checkedAt: stamp() };
    }, '公路估算已保存；不代表实际车次、大巴路线或预订已确认。')) selectRoute(id);
  } catch (error) { toast('未能计算公路路线，保留站点连线：' + error.message); }
  finally { routing = false; }
}
document.addEventListener('click', async event => {
  const target = event.target.closest('button');
  if (!target) return;
  const d = target.dataset;
  if ('addDay' in d) editDay();
  if (d.editDay) editDay(d.editDay);
  if (d.route) selectRoute(d.route);
  if (d.showMap) { selectRoute(d.showMap); $('#route').scrollIntoView({ behavior: 'smooth' }); }
  if (d.road) calculateRoad(d.road);
  if (d.filter) { filter = d.filter; document.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('selected', b.dataset.filter === filter); b.setAttribute('aria-pressed', b.dataset.filter === filter); }); renderDays(); }
  if (d.deleteDay && await confirmAction('删除这一天的行程和地图路线？其他日期不会改变。')) commit(s => { s.days = s.days.filter(x => x.id !== d.deleteDay); if (selectedDay === d.deleteDay) selectedDay = null; });
  if (d.moveDay) commit(s => { const i = s.days.findIndex(x => x.id === d.moveDay), j = i + Number(d.direction); if (i >= 0 && j >= 0 && j < s.days.length) [s.days[i], s.days[j]] = [s.days[j], s.days[i]]; });
  if (d.deletePacking && await confirmAction('从准备清单中移除这件物品？')) commit(s => { s.packing = s.packing.filter(x => x.id !== d.deletePacking); });
  if (d.deleteNote && await confirmAction('删除这条留言？')) commit(s => { s.notes = s.notes.filter(x => x.id !== d.deleteNote); });
  if (d.editGuide) editGuide(d.editGuide);
  if (d.deleteGuide && await confirmAction('删除这条攻略？')) commit(s => { s.guides = s.guides.filter(x => x.id !== d.deleteGuide); });
  if ('pin' in d) pinStop(Number(d.pin));
  if ('removeStop' in d && draftStops.length > 2) { draftStops.splice(Number(d.removeStop), 1); pinIndex = null; $('#picker-container').hidden = true; renderStops(); }
  if (target.id === 'add-stop') { if (draftStops.length >= 20) return toast('一天最多记录 20 个站点。'); draftStops.splice(draftStops.length - 1, 0, { name: '', point: null }); pinIndex = null; $('#picker-container').hidden = true; renderStops(); }
  if (target.id === 'clear-pin' && pinIndex !== null) { draftStops[pinIndex].point = null; if (pickerMarker) picker.removeLayer(pickerMarker); renderStops(); }
});
document.addEventListener('input', event => { if ('stopName' in event.target.dataset) draftStops[Number(event.target.dataset.stopName)].name = event.target.value; });
document.addEventListener('change', event => { if (event.target.dataset.check) { const checked = event.target.checked; if (!commit(s => { const item = s.packing.find(x => x.id === event.target.dataset.check); if (item) item.done = checked; }, '')) renderPacking(); } });
$('#packing-form').onsubmit = event => { event.preventDefault(); const form = new FormData(event.currentTarget); const name = String(form.get('name')).trim(); if (!name) return; if (commit(s => s.packing.push({ id: uuid(), name, category: form.get('category'), done: false }))) $('#packing-name').value = ''; };
$('#note-form').onsubmit = event => { event.preventDefault(); const form = new FormData(event.currentTarget), body = String(form.get('body')).trim(); if (!body) return; if (commit(s => s.notes.push({ id: uuid(), body, author: String(form.get('author')).trim(), createdAt: stamp() }))) $('#note-body').value = ''; };
$('#add-guide').onclick = () => editGuide();
$('#fit-map').onclick = () => { selectedDay = null; renderRoutes(); drawMap(); fitMap(); };
function download(text, filename) { const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000); }
$('#export').onclick = () => { const text = writable ? JSON.stringify(state, null, 2) : lastSaved; if (!text) return toast('未能读取原数据，请保留当前浏览器。'); $('#backup-text').value = text; $('#backup-feedback').textContent = ''; $('#backup-dialog').showModal(); };
$('#backup-close').onclick = () => $('#backup-dialog').close();
$('#backup-download').onclick = () => { download($('#backup-text').value, 'Travelagent-' + new Date().toISOString().slice(0, 10) + '.json'); $('#backup-feedback').textContent = '已请求下载；若浏览器未保存文件，可使用复制内容。'; };
$('#backup-copy').onclick = async () => { try { await navigator.clipboard.writeText($('#backup-text').value); $('#backup-feedback').textContent = '备份已复制。'; } catch { $('#backup-text').select(); $('#backup-feedback').textContent = '请按 Ctrl+C（Mac 使用 Command+C）复制选中的备份。'; } };
$('#import').onclick = () => $('#import-file').click();
$('#import-file').onchange = async event => {
  const file = event.target.files[0]; event.target.value = '';
  if (!file) return;
  const baseline = lastSaved;
  try {
    if (file.size > 8 * 1024 * 1024) throw new Error('备份文件不能超过 8 MB。');
    const incoming = validateState(JSON.parse(await file.text()));
    if (!await confirmAction('用「' + incoming.trip.title + '」的备份替换当前旅行？建议先导出当前内容。')) return;
    if (lastSaved !== baseline) throw new Error('确认期间内容已变化，请重新导入。');
    commit(s => { Object.assign(s, incoming); selectedDay = null; }, '备份已导入');
  } catch (error) { toast('未导入：' + error.message); }
};
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY || !writable) return;
  try { const next = event.newValue ? validateState(JSON.parse(event.newValue)) : blankState(); state = next; lastSaved = event.newValue; render(); toast('已更新为另一页面保存的内容。'); }
  catch { toast('另一页面的数据格式无法读取；当前内容未覆盖。'); }
});
document.querySelectorAll('.section-nav a').forEach(a => a.onclick = () => { document.querySelectorAll('.section-nav a').forEach(link => link.classList.toggle('active', link === a)); });
render(); fitMap();
