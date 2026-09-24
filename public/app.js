import { mountLightbox } from './lightbox.js';
import { dayMediaHTML, mountDayMedia } from './day-media.js';
import { guideHTML } from './guides.js';
import { STORAGE_KEY, COLORS, CATEGORIES, MODES, GUIDE_CATEGORIES, blankState, validateState, routeSignature, dayForSave, activitySegments, mergeDayActivities, mergeRoutePlans, mergeGuides, mergeActivityPhotos } from './model.js';
import { createMap, addBasemap } from './map.js';
import { planPlaces, forgetEvent } from './journeys.js';
import { COUNTRIES } from './countries.js';
import { loadInitialTrip } from './initial-trip.js';
mountLightbox();
let mapView = 'transit', expanded = false, savedScroll = 0;
const selectedPlans = new Map(), placeMarkers = new Map();
let highlightedLeg = null;
const activityStatus = { pending: '计划 · 待确认', confirmed: '已确认', optional: '备选 · 未选定' };
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
  const initial = await loadInitialTrip(localStorage, async () => {
    const response = await fetch(new URL('./published-trip.json', import.meta.url), { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Published trip unavailable');
    return response.json();
  });
  state = initial.state; lastSaved = initial.serialized;
} catch {
  writable = false;
  try { lastSaved = localStorage.getItem(STORAGE_KEY); } catch {}
  const warning = document.createElement('p');
  warning.className = 'storage-warning';
  warning.textContent = '旅行内容暂时无法加载，已暂停保存。请检查网络后刷新；已有本机资料请先导出备份，不要清除浏览器数据。';
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
function mapStops(day) { return selectedDay === day.id && mapView === 'activities' ? day.activities : day.stops; }
function drawMap() {
  if (!map) return;
  layers.clearLayers(); placeMarkers.clear();
  const focused = state.days.find(d => d.id === selectedDay);
  if (focused?.routePlans.length && mapView === 'activities') { drawPlan(focused); $('#map-empty').hidden = true; return; }
  let pointsCount = 0;
  state.days.forEach((day, index) => {
    // A selected day gets an uncluttered map; the full view keeps every day.
    if (selectedDay && selectedDay !== day.id) return;
    if (!selectedDay && day.routePlans.length) {
      const shown = day.routePlans.flatMap((p, pi) => p.legs.filter(l => pi === 0 || l.mode.startsWith('飞机')).map(l => ({p,l})));
      shown.forEach(({p,l}) => {
        const a=p.stops.find(s=>s.id===l.from),b=p.stops.find(s=>s.id===l.to);
        if(!a.point||!b.point)return;
        const path=l.road?.points || [a.point,b.point]; pointsCount+=2;
        L.polyline(path,{color:'#fff',weight:9,opacity:.95,interactive:false}).addTo(layers);
        L.polyline(path,{color:color(index),weight:5,opacity:1,dashArray:l.road?null:'12 7'}).addTo(layers).on('click',()=>showLeg(day.id,p.id,l.id));
      });
      return;
    }
    const daily = selectedDay === day.id && mapView === 'activities';
    const stops = mapStops(day), routeColor = color(index);
    pointsCount += stops.filter(s => s.point).length;
    const paths = daily ? activitySegments(stops) : activitySegments((day.road?.points || stops.map(s => s.point)).map(point => ({ point })));
    paths.forEach(path => {
      L.polyline(path, { color: '#fff', weight: selectedDay ? 11 : 9, opacity: .98, interactive: false }).addTo(layers);
      L.polyline(path, { color: routeColor, weight: selectedDay ? 7 : 5, opacity: 1, dashArray: !daily && day.road ? null : '14 6' }).addTo(layers).on('click', () => selectRoute(day.id));
      const step = Math.max(1, Math.floor((path.length - 1) / 6));
      for (let i = step; i < path.length; i += step) {
        const a = map.project(path[i - 1]), b = map.project(path[i]);
        if (a.distanceTo(b) < 24) continue;
        const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        const midpoint = map.unproject(a.add(b).divideBy(2));
        L.marker(midpoint, { interactive: false, keyboard: false, icon: L.divIcon({ className: 'direction-marker', iconSize: [24, 24], iconAnchor: [12, 12], html: '<span style="color:' + routeColor + ';transform:rotate(' + angle + 'deg)">➤</span>' }) }).addTo(layers);
      }
    });
    if (!selectedDay && planPlaces(state.days).length) return;
    stops.forEach((stop, si) => {
      if (!stop.point) return;
      const label = (selectedDay ? '' : 'D' + (index + 1) + ' · ') + (si + 1) + ' ' + stop.name;
      const marker = selectedDay ? L.marker(stop.point, { title: label, icon: L.divIcon({ className: 'route-number ' + (stop.status === 'optional' ? 'optional' : ''), html: '<span style="--route-color:' + routeColor + '">' + (si + 1) + '</span>', iconSize: [28, 28], iconAnchor: [14, 14] }) }) : L.circleMarker(stop.point, { radius: 6, color: '#fff', fillColor: routeColor, fillOpacity: 1, weight: 2 });
      marker.on('click', () => { if (daily) showEvent(day.id, stop.id); else showDay(day.id); });
      marker.addTo(layers).bindTooltip(esc(label), { permanent: Boolean(selectedDay), direction: 'top', offset: [0, -12], className: 'map-label' });
    });
  });
  if (!selectedDay) { const places = planPlaces(state.days); drawPlaces(places); pointsCount += places.length; }
  $('#map-empty').hidden = pointsCount > 0;
  const mapAction = $('#map-empty button');
  for (const key of ['addDay', 'editDay', 'addActivity', 'activity', 'activityDay']) delete mapAction.dataset[key];
  const selected = state.days.find(d => d.id === selectedDay);
  if (selected && mapView === 'activities') {
    if (selected.activities.length) { mapAction.dataset.activity = selected.activities[0].id; mapAction.dataset.activityDay = selected.id; mapAction.textContent = '标记当日安排位置 →'; }
    else { mapAction.dataset.addActivity = selected.id; mapAction.textContent = '添加当日安排 →'; }
  } else if (state.days.length) { delete mapAction.dataset.addDay; mapAction.dataset.editDay = selectedDay || state.days[0].id; mapAction.textContent = '编辑行程位置 →'; }
  else { delete mapAction.dataset.editDay; mapAction.dataset.addDay = ''; mapAction.textContent = '添加第一天 →'; }
  const title = $('#map-empty strong'), detail = $('#map-empty > span:not(.small-compass)');
  title.textContent = selectedDay ? '这一天的位置待补充' : '下一站，由你决定';
  detail.textContent = selectedDay ? '当日安排仍可在右侧查看；未知位置不会连线。' : '添加行程，在地图上标记出发地与目的地。';
}
function fitMap(day) {
  if (!map) return;
  const days = day ? [day] : state.days;
  if (day?.routePlans.length && mapView === 'activities') { const plan = activePlan(day), points = [...plan.stops.map(s => s.point).filter(Boolean), ...plan.legs.flatMap(l => l.road?.points || [])]; if (points.length) map.fitBounds(points, {padding:[55,55],maxZoom:15,animate:false}); return; }
  const points = days.flatMap(d => !day && d.routePlans.length ? d.routePlans.flatMap(p => p.stops.map(s=>s.point).filter(Boolean)) : day && mapView === 'activities' ? d.activities.map(s => s.point).filter(Boolean) : d.road?.points || d.stops.map(s => s.point).filter(Boolean));
  if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 14, animate:false });
  else if (day) toast('这一天还未标记位置，可先查看文字安排。');
}
function selectRoute(id) {
  selectedDay = id; highlightedLeg = null;
  mapView = state.days.find(d => d.id === id)?.activities.length || state.days.find(d => d.id === id)?.routePlans.length ? 'activities' : 'transit';
  renderRoutes(); drawMap(); fitMap(state.days.find(d => d.id === id));
}
function activityList(day, compact = false) {
  if (!day.activities.length) return '<p class="form-hint">还没有当日安排，可以添加景点、用餐、接送和入住。</p>';
  return '<ol class="activity-list' + (compact ? ' compact' : '') + '">' + day.activities.map((a, i) => '<li' + (!compact ? ' id="event-' + day.id + '-' + a.id + '" tabindex="-1"' : '') + '><span class="activity-number">' + (i + 1) + '</span><div><div class="activity-time">' + esc(a.time || '时间待定') + '</div><strong>' + esc(a.name) + '</strong> <span class="status ' + a.status + '">' + activityStatus[a.status] + '</span><p class="activity-meta">' + esc([a.duration && '停留 / 用时：' + a.duration, a.transport && '前往：' + a.transport, !a.point && !day.routePlans.some(p => p.stops.some(s => s.point && s.eventIds.includes(a.id))) && '位置待补充'].filter(Boolean).join(' · ')) + '</p>' + '<div class="activity-controls">' + eventMapButtons(day, a) + (compact ? '<button class="text-button" data-go-event="' + a.id + '" data-day="' + day.id + '">查看事件详情 ↗</button>' : '') + '</div>' + (!compact ? eventTravel(day,a) + (a.note ? '<p class="activity-note">' + esc(a.note) + '</p>' : '') + (a.url ? '<a class="text-button" href="' + esc(a.url) + '" target="_blank" rel="noopener noreferrer">位置 / 信息来源 ↗</a>' : '') + '<div class="activity-controls"><button class="text-button" data-activity="' + a.id + '" data-activity-day="' + day.id + '">编辑安排</button><button class="text-button" data-move-activity="' + a.id + '" data-activity-day="' + day.id + '" data-direction="-1"' + (!i ? ' disabled' : '') + '>上移</button><button class="text-button" data-move-activity="' + a.id + '" data-activity-day="' + day.id + '" data-direction="1"' + (i === day.activities.length - 1 ? ' disabled' : '') + '>下移</button><button class="text-button" data-delete-activity="' + a.id + '" data-activity-day="' + day.id + '">删除</button></div>' : '') + '</div></li>').join('') + '</ol>';
}
function renderMapDetails() {
  const day = state.days.find(d => d.id === selectedDay);
  $('#map-view-switch').hidden = !day;
  document.querySelectorAll('[data-map-view]').forEach(b => { b.classList.toggle('selected', b.dataset.mapView === mapView); b.setAttribute('aria-pressed', b.dataset.mapView === mapView); });
  $('#map-view-label').textContent = day ? 'D' + (state.days.indexOf(day) + 1) + ' · ' + (day.date || '日期待定') : '';
  $('#map-plan-switch').innerHTML = day && mapView === 'activities' && day.routePlans.length > 1 ? day.routePlans.map(p=>'<button class="'+(p.id===activePlan(day).id?'selected':'')+'" data-plan="'+p.id+'" data-day="'+day.id+'" aria-pressed="'+(p.id===activePlan(day).id)+'">'+esc(p.name)+'</button>').join('') : '';
  const country = COUNTRIES.find(c => c.code === state.trip.countryCode);
  $('#country-map').textContent = country ? '聚焦' + country.name : '设置目标国';
}
function renderRoutes() {
  renderMapDetails();
  $('#route-count').textContent = state.days.length + ' DAYS';
  $('#route-list').innerHTML = state.days.length ? state.days.map((d, i) => '<div class="route-row"><button class="route-item ' + (selectedDay === d.id ? 'selected' : '') + '" data-route="' + d.id + '" aria-pressed="' + (selectedDay === d.id) + '"><span class="day-badge" style="--day-color:' + color(i) + '">D' + (i + 1) + '</span><span><strong>' + esc(routeName(d)) + '</strong><small>' + (d.activities.length ? d.activities.length + ' 项当日安排 · ' + (d.date || '日期待定') : d.road ? (d.road.distance / 1000).toFixed(1) + ' km · 公路估算' : d.stops.every(s => s.point) ? '站点连线 · 待规划道路' : '地图位置待补充') + '</small></span></button><button class="text-button route-day-link" data-go-day="'+d.id+'" aria-label="打开 D'+(i+1)+' 完整行程">行程 ↗</button></div>').join('') : '<div class="route-empty">从一份日程开始，<br>慢慢描绘旅行的轮廓。</div>';
}
let disposeDayMedia;
function renderDays() {
  disposeDayMedia?.();
  const visible = state.days.filter(d => filter === 'all' || d.status === 'confirmed');
  $('#itinerary-count').textContent = visible.length ? visible.length + ' 天安排' : filter === 'confirmed' ? '尚无已确认行程' : '还没有安排';
  $('#days').innerHTML = visible.length ? visible.map(d => {
    const index = state.days.indexOf(d);
    const roadHint = d.road ? '<div class="day-detail">公路估算 ' + (d.road.distance / 1000).toFixed(1) + ' km · ' + Math.round(d.road.duration / 60) + ' 分钟（不含停留）</div>' : '';
    return '<article id="day-' + d.id + '" tabindex="-1" class="day-card ' + d.status + '" style="--day-color:' + color(index) + '"><div><div class="day-number">D' + (index + 1) + '</div><div class="day-date">' + esc(d.date || '日期待定') + '</div></div><div><div class="day-heading"><div class="day-route">' + esc(routeName(d)) + '</div><button class="button primary day-map-button" data-show-map="' + d.id + '" aria-label="查看 D' + (index + 1) + ' 路线地图"><span aria-hidden="true">⌖</span> 查看路线地图</button></div><div class="day-detail"><span>' + esc(d.mode) + '</span><span>' + esc(d.departure || '出发待定') + ' — ' + esc(d.arrival || '到达待定') + '</span><span>时长：' + esc(d.duration || '待补充') + '</span></div>' + roadHint + ((d.note || d.source) ? '<details class="day-context"><summary>行程备注与来源</summary><p class="day-description">' + esc(d.note) + '</p><div class="day-detail">' + esc(d.source) + '</div></details>' : '') + (['自驾', '大巴'].includes(d.mode) ? ' <button class="text-button route-action" data-road="' + d.id + '">' + (d.road ? '更新公路估算' : '计算公路路线') + '</button>' : '') + '</div><div class="day-lodging"><span class="label">当晚住在</span><strong>' + esc(d.lodging || '住宿待补充') + '</strong><div class="day-detail"><span class="status ' + d.lodgingStatus + '">' + (d.lodgingStatus === 'confirmed' ? '住宿已确认' : '住宿待确认') + '</span></div></div><div class="day-controls"><span class="status ' + d.status + '">' + (d.status === 'confirmed' ? '✓ 行程已确认' : '行程待确认') + '</span><div class="day-buttons"><button class="text-button" data-edit-day="' + d.id + '">编辑</button><button class="text-button" data-delete-day="' + d.id + '">删除</button></div><div class="day-buttons"><button class="text-button" aria-label="提前 D' + (index + 1) + '" data-move-day="' + d.id + '" data-direction="-1"' + (index === 0 ? ' disabled' : '') + '>↑</button><button class="text-button" aria-label="后移 D' + (index + 1) + '" data-move-day="' + d.id + '" data-direction="1"' + (index === state.days.length - 1 ? ' disabled' : '') + '>↓</button></div></div>' + dayMediaHTML(d, esc) + itineraryTransport(d) + '<details class="day-activities" open><summary>当日安排 · ' + d.activities.length + ' 项</summary><p class="itinerary-time-note">当地时间</p>' + activityList(d) + '<button class="text-button" data-add-activity="' + d.id + '">＋ 添加当日安排</button></details>' + '</article>';
  }).join('') : empty(filter === 'confirmed' ? '把确定的安排，留在这里' : '旅行还没有开始，计划可以先走一步', filter === 'confirmed' ? '编辑日程并明确选择“已确认”后，将在这里显示。' : '添加第一天，记录出发地、目的地、住宿和大致时长。');
  disposeDayMedia = mountDayMedia($('#days'), visible, esc, showEvent, (id, planId) => { if(planId) selectedPlans.set(id,planId); selectRoute(id); scrollMap(); });
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
  const opened = new Set([...document.querySelectorAll('.guide-card[open]')].map(el => el.id));
  $('#guide-list').innerHTML = state.guides.length ? state.guides.map(g => guideHTML(g, esc, opened.has('guide-' + g.id))).join('') : empty('把有用的信息，收进旅行口袋', '收藏步骤、沟通话术与参考图片，记录来源和核验日期。');
  document.querySelectorAll('.guide-figure img').forEach(img => { img.onerror = () => { img.hidden = true; img.closest('figure').querySelector('.image-fallback').hidden = false; }; });
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
$('#edit-trip').onclick = () => openEditor('这次旅行', '<div class="form-grid">' + field('title', '旅行名称', state.trip.title, 'text', true, true, 80) + field('destination', '目的地', state.trip.destination, 'text', true, false, 120) + select('countryCode', '地图目标国家 / 地区', [['', '请选择（可稍后补充）'], ...COUNTRIES.map(c => [c.code, c.name]).sort((a, b) => a[1].localeCompare(b[1], 'zh'))], state.trip.countryCode) + field('startDate', '出发日期', state.trip.startDate, 'date') + field('endDate', '结束日期', state.trip.endDate, 'date') + '</div>', form => commit(s => { s.trip = Object.fromEntries(form); }));
function renderStops() {
  $('#stop-list').innerHTML = draftStops.map((s, i) => '<div class="stop-row"><span>' + (i + 1) + '</span><input data-stop-name="' + i + '" aria-label="站点 ' + (i + 1) + ' 名称" placeholder="' + (i === 0 ? '出发地' : i === draftStops.length - 1 ? '目的地' : '途经地') + '" value="' + esc(s.name) + '" required maxlength="120"><button type="button" class="pin-button ' + (s.point ? 'located' : '') + '" data-pin="' + i + '">' + (s.point ? '✓ 已定位' : '地图定位') + '</button><button type="button" class="icon-button" data-remove-stop="' + i + '" aria-label="移除站点 ' + (i + 1) + '"' + (draftStops.length <= 2 ? ' disabled' : '') + '>×</button></div>').join('');
}
function editDay(id) {
  const original = state.days.find(d => d.id === id);
  const d = original || { id: uuid(), date: '', stops: [{ name: '', point: null }, { name: '', point: null }], mode: '待定', departure: '', arrival: '', duration: '', lodging: '', lodgingStatus: 'pending', status: 'pending', note: '', source: '', road: null };
  draftStops = structuredClone(d.stops);
  openEditor(original ? '编辑 D' + (state.days.indexOf(original) + 1) + ' 行程' : '添加第 ' + (state.days.length + 1) + ' 天', (original?.status === 'confirmed' || original?.lodgingStatus === 'confirmed' ? '<p class="warning-note">这天已有确认记录。保存前请重新核实行程与住宿的确认状态，避免沿用旧安排的确认结果。</p>' : '') + '<div class="form-grid">' + field('date', '行程日期（可稍后补充）', d.date, 'date') + select('status', '行程确认状态', statusOptions, 'pending') + '</div><p class="form-hint">按出行顺序添加站点；地图定位可稍后补充，不影响保存日程。</p><div id="stop-list" class="stop-list"></div><button type="button" id="add-stop" class="text-button">＋ 增加途经地</button><div id="picker-container" hidden><p class="picker-instruction" id="picker-instruction"></p><div id="picker-map"></div><button type="button" id="clear-pin" class="text-button">清除此站地图位置</button></div><div class="form-grid" style="margin-top:20px">' + select('mode', '主要交通方式', MODES, d.mode) + field('duration', '大致时长（如车程 2 小时）', d.duration, 'text', false, false, 80) + field('departure', '出发时间（当地时间）', d.departure, 'time') + field('arrival', '到达时间（当地时间）', d.arrival, 'time') + field('lodging', '当晚住宿地点 / 酒店', d.lodging, 'text', true) + select('lodgingStatus', '住宿确认状态', statusOptions, 'pending') + field('source', '确认依据（订单/资料说明，选填）', d.source, 'text', true, false, 500) + textArea('note', '当天安排与备注', d.note) + '</div>', form => {
    const updated = dayForSave(original, { id: d.id, ...Object.fromEntries(form), stops: structuredClone(draftStops), activities: d.activities || [], routePlans: d.routePlans || [], road: null });
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
function editActivity(dayId, activityId) {
  const day = state.days.find(d => d.id === dayId);
  if (!day) return;
  if (!activityId && day.activities.length >= 40) return toast('一天最多记录 40 项安排。');
  const a = day.activities.find(a => a.id === activityId) || { id: uuid(), name: '', point: null, time: '', duration: '', transport: '', status: 'pending', note: '', url: '' };
  draftStops = [{ name: a.name, point: a.point }];
  openEditor(activityId ? '编辑当日安排' : '添加当日安排', '<p class="form-hint">按一天内的先后顺序记录；备选安排单独显示，不接入路线。</p><div id="stop-list"></div><div id="picker-container" hidden><p class="picker-instruction" id="picker-instruction"></p><div id="picker-map"></div><button type="button" id="clear-pin" class="text-button">清除此站地图位置</button></div><div class="form-grid">' + field('time', '当地时间 / 建议时段', a.time, 'text', false, false, 80) + select('status', '本项确认状态', [...statusOptions, ['optional', '备选（未选定）']], a.status) + field('duration', '停留 / 用时（建议需注明）', a.duration, 'text', false, false, 80) + field('transport', '前往这一站的交通 / 耗时', a.transport, 'text', false, false, 80) + textArea('note', '安排说明、预约依据与待确认事项', a.note, 1500) + field('url', '位置 / 信息来源（选填）', a.url, 'url', true, false, 2000) + '</div>', form => commit(s => {
    const current = s.days.find(d => d.id === dayId);
    const record = { ...a, ...Object.fromEntries(form), ...draftStops[0] };
    const index = current.activities.findIndex(x => x.id === a.id);
    if (index < 0) current.activities.push(record); else current.activities[index] = record;
  }));
  renderStops();
}
function editGuide(id) {
  const g = state.guides.find(g => g.id === id) || { id: uuid(), title: '', category: '交通出行', body: '', summary: '', url: '', checkedDate: '', sections: [] };
  const chapters = g.sections.map((s,i) => '<fieldset class="field full"><legend>章节 ' + (i+1) + '</legend>' + field('s'+i+'title', '章节标题', s.title, 'text', true, false, 160) + textArea('s'+i+'body','章节说明',s.body,6000) + s.steps.map((x,j) => field('s'+i+'t'+j,'步骤 '+(j+1)+' 标题',x.title,'text',true,false,160) + textArea('s'+i+'b'+j,'操作说明',x.body,6000)).join('') + s.phrases.map((x,j) => textArea('s'+i+'en'+j,'英文话术 '+(j+1),x.en,1500) + textArea('s'+i+'zh'+j,'中文含义',x.zh,1500)).join('') + '</fieldset>').join('');
  openEditor(id ? '编辑攻略' : '收下一条实用攻略', '<div class="form-grid">' + field('title', '标题', g.title, 'text', true, true, 120) + select('category', '分类', GUIDE_CATEGORIES, g.category) + field('checkedDate', '核验日期（未核验则留空）', g.checkedDate, 'date') + textArea('summary','折叠时的摘要',g.summary,500) + textArea('body', '攻略内容 / 阅读前提示', g.body, 8000) + field('url', '信息来源链接（选填）', g.url, 'url', true, false, 2000) + chapters + '</div>', form => commit(s => {
    const record = { ...g };
    for (const key of ['title','category','checkedDate','summary','body','url']) record[key] = form.get(key);
    record.sections = g.sections.map((x,i) => ({ ...x, title:form.get('s'+i+'title'), body:form.get('s'+i+'body'), steps:x.steps.map((step,j) => ({title:form.get('s'+i+'t'+j),body:form.get('s'+i+'b'+j)})), phrases:x.phrases.map((p,j) => ({en:form.get('s'+i+'en'+j),zh:form.get('s'+i+'zh'+j)})) }));
    const index = s.guides.findIndex(x => x.id === g.id); if (index < 0) s.guides.push(record); else s.guides[index] = record;
  }));
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
  if (d.goDay) showDay(d.goDay);
  if (d.goEvent) showEvent(d.day, d.goEvent);
  if (d.place) showPlace(d.place, d.day, d.planId);
  if (d.plan) { selectedPlans.set(d.day, d.plan); selectRoute(d.day); scrollMap(); }
  if (d.leg) showLeg(d.day, d.planId, d.leg);
  if (d.editLeg) editLeg(d.day, d.planId, d.editLeg);
  if (d.editPoint) editPlanPoint(d.day, d.planId, d.editPoint);
  if ('addDay' in d) editDay();
  if (d.addActivity) editActivity(d.addActivity);
  if (d.activity) editActivity(d.activityDay, d.activity);
  if (d.mapView) { mapView = d.mapView; renderMapDetails(); drawMap(); fitMap(state.days.find(x => x.id === selectedDay)); }
  if (d.moveActivity) commit(s => { const list = s.days.find(x => x.id === d.activityDay).activities; const i = list.findIndex(a => a.id === d.moveActivity), j = i + Number(d.direction); if (i >= 0 && j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]]; });
  if (d.deleteActivity && await confirmAction('删除这项当日安排？当天其他安排不变。')) commit(s => { const day = s.days.find(x => x.id === d.activityDay); day.activities = day.activities.filter(a => a.id !== d.deleteActivity); forgetEvent(day.routePlans, d.deleteActivity); });
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
map?.on('zoomend', drawMap);
$('#fit-map').onclick = () => { selectedDay = null; renderRoutes(); drawMap(); fitMap(); };
$('#country-map').onclick = () => {
  const country = COUNTRIES.find(c => c.code === state.trip.countryCode);
  if (!country) { $('#edit-trip').click(); return; }
  selectedDay = null; mapView = 'transit'; renderRoutes(); drawMap();
  map?.fitBounds(country.bounds, { padding: [30, 30], maxZoom: 8, animate:false });
};
let inertBefore = [];
function expandMap(value) {
  expanded = value;
  const section = $('#route');
  if (value) {
    savedScroll = window.scrollY;
    inertBefore = [...document.querySelectorAll('main > :not(#route), body > header, body > .skip')].map(el => [el, el.inert]);
    inertBefore.forEach(([el]) => el.inert = true);
    section.setAttribute('role', 'dialog'); section.setAttribute('aria-modal', 'true');
  } else {
    inertBefore.forEach(([el, prior]) => el.inert = prior); inertBefore = [];
    section.removeAttribute('role'); section.removeAttribute('aria-modal');
  }
  document.body.classList.toggle('map-is-expanded', value);
  section.classList.toggle('map-expanded', value);
  $('#expand-map').textContent = value ? '收起地图 ⤡' : '全屏展开 ⛶';
  $('#expand-map').setAttribute('aria-expanded', value);
  $('#expand-map').title = value ? '收起地图（也可按 Esc）' : '展开至整个页面';
  requestAnimationFrame(() => { map?.invalidateSize({ animate: false }); if (!value) window.scrollTo({ top: savedScroll, behavior: 'instant' }); $('#expand-map').focus({ preventScroll: true }); });
}
$('#expand-map').onclick = () => expandMap(!expanded);
$('#toggle-routes').onclick = () => {
  const hidden = !$('#route-sidebar').hidden;
  $('#route-sidebar').hidden = hidden;
  $('#route').classList.toggle('routes-collapsed', hidden);
  $('#toggle-routes').setAttribute('aria-expanded', String(!hidden));
  $('#toggle-routes').textContent = hidden ? '展开每日路线 ‹' : '收起每日路线 ›';
  requestAnimationFrame(() => map?.invalidateSize({ animate: false }));
};
document.addEventListener('keydown', event => {
  if (!expanded || document.querySelector('dialog[open]')) return;
  if (event.key === 'Escape') { event.preventDefault(); expandMap(false); }
  if (event.key === 'Tab') {
    const nodes = [...$('#route').querySelectorAll('button:not(:disabled), a[href], [tabindex="0"]')].filter(el => el.getClientRects().length);
    const first = nodes[0], last = nodes.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});
new ResizeObserver(() => map?.invalidateSize({ animate: false })).observe($('#map'));
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
    const raw = JSON.parse(await file.text());
    if (raw.kind === 'activityPhotos') {
      mergeActivityPhotos(state, raw);
      if (!await confirmAction('为 ' + raw.updates.length + ' 天补充景观参考照片？保留现有行程、确认状态、路线和准备清单。')) return;
      if (lastSaved !== baseline) throw Error('确认期间内容已变化，请重新导入。');
      commit(s => Object.assign(s, mergeActivityPhotos(s, raw)), '景观参考照片已补充'); return;
    }
    if (raw.kind === 'guidesAppend') {
      mergeGuides(state, raw);
      if (!await confirmAction('新增 ' + raw.guides.length + ' 篇图文操作攻略？保留现有攻略、行程、清单和留言。')) return;
      if (lastSaved !== baseline) throw Error('确认期间内容已变化，请重新导入。');
      commit(s => Object.assign(s, mergeGuides(s, raw)), '图文攻略已补充'); return;
    }
    if (raw.kind === 'routePlans') {
      mergeRoutePlans(state, raw);
      if (!await confirmAction('补充 ' + raw.updates.length + ' 天的具体点位与分段交通？现有事件、确认状态、物品勾选、留言和攻略将保留。')) return;
      if (lastSaved !== baseline) throw new Error('确认期间内容已变化，请重新导入。');
      commit(s => Object.assign(s, mergeRoutePlans(s, raw)), '具体点位与分段交通已补充'); return;
    }
    if (raw.kind === 'dayActivities') {
      mergeDayActivities(state, raw);
      if (!await confirmAction('补充 ' + raw.updates.length + ' 天的当日安排？现有行程、物品勾选、留言和攻略将保留。已有当日安排不会被覆盖。')) return;
      if (lastSaved !== baseline) throw new Error('确认期间内容已变化，请重新导入。');
      commit(s => Object.assign(s, mergeDayActivities(s, raw)), '当日安排已补充'); return;
    }
    const incoming = validateState(raw);
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
render(); const initialCountry = COUNTRIES.find(c => c.code === state.trip.countryCode); if (initialCountry && planPlaces(state.days).length) map?.fitBounds(initialCountry.bounds, {padding:[30,30],maxZoom:8,animate:false}); else fitMap();
function activePlan(day) { return day.routePlans.find(p => p.id === selectedPlans.get(day.id)) || day.routePlans[0]; }
function placeKey(point) { return point?.map(n => n.toFixed(5)).join(','); }
function pointButton(stop, day, plan, label = stop.name) {
  return stop.point ? '<button class="text-button" data-place="' + placeKey(stop.point) + '" data-day="' + day.id + '" data-plan-id="' + plan.id + '">' + esc(label) + ' ↗</button>' : '<span>' + esc(label) + ' · 位置待补</span>';
}
function eventMapButtons(day, event) {
  const matches = day.routePlans.flatMap(p => p.stops.filter(s => s.eventIds.includes(event.id) && s.point).map(s => ({ p, s })));
  const seen = new Set();
  return matches.filter(({s}) => { const key = placeKey(s.point); if (seen.has(key)) return false; seen.add(key); return true; }).map(({p,s}) => pointButton(s, day, p, '地图 · ' + s.name)).join('') || (event.point ? '<button class="text-button" data-place="' + placeKey(event.point) + '" data-day="' + day.id + '">在地图定位 ↗</button>' : '');
}
function placePopup(place) {
  const seen = new Set();
  return '<div class="place-popup"><strong>' + esc(place.name) + '</strong>' + place.refs.map(ref => {
    const day = state.days.find(d => d.id === ref.dayId);
    const events = ref.eventIds.map(id => day.activities.find(a => a.id === id)).filter(Boolean).filter(a => { const key = day.id + a.id; if (seen.has(key)) return false; seen.add(key); return true; });
    if (!events.length && ref.eventIds.length) return '';
    return '<div class="place-association"><small>D' + (state.days.indexOf(day) + 1) + ' · ' + esc(day.date) + '</small>' + events.map(a => '<button class="text-button" data-go-event="' + a.id + '" data-day="' + day.id + '">' + esc(a.name) + ' · ' + activityStatus[a.status] + ' ↗</button>').join('') + '<button class="text-button" data-go-day="' + day.id + '">完整行程</button> ' + (ref.planId ? '<button class="text-button" data-plan="' + ref.planId + '" data-day="' + day.id + '">查看当天路线</button>' : '') + (ref.url ? ' <a href="' + esc(ref.url) + '" target="_blank" rel="noopener noreferrer">位置来源</a>' : '') + '</div>';
  }).join('') + '</div>';
}
function drawPlaces(places, numbered = false, routeColor = '#285d46') {
  const groups = [];
  for (const place of places) {
    const projected = map.project(place.point);
    const group = !numbered && groups.find(g => map.project(g[0].point).distanceTo(projected) < 45);
    if (group) group.push(place); else groups.push([place]);
  }
  groups.forEach(group => {
    const place = group[0], cluster = group.length > 1;
    const label = cluster ? place.name + '等 ' + group.length + ' 处 · 点击放大' : place.name;
    const marker = L.marker(place.point, { title: label, icon: L.divIcon({ className: 'route-number' + (cluster ? ' poi-cluster' : ''), html: '<span style="--route-color:' + routeColor + '">' + (cluster ? group.length : numbered ? places.indexOf(place) + 1 : '●') + '</span>', iconSize:[28,28],iconAnchor:[14,14] }) }).addTo(layers);
    marker.bindTooltip(esc(label), { permanent: true, direction:numbered ? (places.indexOf(place)%2 ? 'left' : 'right') : 'top',offset:numbered ? [14,0] : [0,-13],className:'map-label' });
    if (cluster) marker.on('click', () => map.fitBounds(group.map(p => p.point), {padding:[60,60],maxZoom:17,animate:false}));
    else { marker.bindPopup(placePopup(place), {maxWidth:330,maxHeight:300,autoPanPadding:[25,25]}); placeMarkers.set(place.key, marker); }
  });
}
function drawPlan(day) {
  const plan = activePlan(day), routeColor = color(state.days.indexOf(day));
  for (const leg of plan.legs) {
    const from = plan.stops.find(s => s.id === leg.from), to = plan.stops.find(s => s.id === leg.to);
    if (!from.point || !to.point) continue;
    const path = leg.road?.points || [from.point,to.point], active = highlightedLeg === leg.id;
    L.polyline(path, {color:'#fff',weight:active?14:10,opacity:1,interactive:false}).addTo(layers);
    const line = L.polyline(path, {color:routeColor,weight:active?9:6,opacity:1,dashArray:leg.road?null:'10 7'}).addTo(layers)
      .bindTooltip(esc(from.name + ' → ' + to.name + ' · ' + leg.mode + ' · ' + leg.duration), {sticky:true})
      .on('click', () => showLeg(day.id,plan.id,leg.id));
    const pathElement=line.getElement();
    pathElement?.setAttribute('role','button'); pathElement?.setAttribute('tabindex','0'); pathElement?.setAttribute('aria-label','路段：'+from.name+' → '+to.name);
    pathElement?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showLeg(day.id,plan.id,leg.id);}});
    const mid = Math.floor(path.length / 2), a = map.project(path[Math.max(0,mid-1)]), b = map.project(path[mid]);
    const angle = Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
    L.marker(map.unproject(a.add(b).divideBy(2)), {interactive:false,keyboard:false,icon:L.divIcon({className:'direction-marker',iconSize:[24,24],iconAnchor:[12,12],html:'<span style="color:'+routeColor+';transform:rotate('+angle+'deg)">➤</span>'})}).addTo(layers);
  }
  const all = planPlaces(state.days), keys = [...new Set(plan.stops.filter(s => s.point).map(s => placeKey(s.point)))];
  drawPlaces(keys.map(k => all.find(p => p.key === k)),true,routeColor);
}
function legCard(day, plan, leg, popup = false) {
  const from = plan.stops.find(s => s.id === leg.from), to = plan.stops.find(s => s.id === leg.to);
  const events = [...new Set([...from.eventIds,...to.eventIds])];
  return '<div class="leg-card' + (highlightedLeg === leg.id ? ' selected' : '') + '" data-leg-card="' + leg.id + '"><div class="leg-endpoints">' + pointButton(from,day,plan) + '<span> → </span>' + pointButton(to,day,plan) + '</div><strong class="leg-time">' + esc(leg.mode) + ' · ' + esc(leg.duration || '时间待确认') + '</strong>' + (leg.road ? '<small>道路约 ' + (leg.road.distance/1000).toFixed(1) + ' km · 行驶基准 ' + Math.round(leg.road.duration/60) + ' 分钟</small>' : '<small>' + (from.point && to.point ? '虚线为顺序示意，不是导航轨迹' : '未知位置未连线') + '</small>') + (leg.note ? '<p>' + esc(leg.note) + '</p>' : '') + '<div class="leg-actions">' + (!popup ? '<button class="text-button" data-leg="' + leg.id + '" data-day="' + day.id + '" data-plan-id="' + plan.id + '">查看这一段 ↗</button>' : '') + events.map(id => '<button class="text-button" data-go-event="' + id + '" data-day="' + day.id + '">事件 ' + (day.activities.findIndex(a => a.id === id)+1) + ' ↗</button>').join('') + '<button class="text-button" data-go-day="' + day.id + '">完整行程 ↗</button><button class="text-button" data-edit-leg="' + leg.id + '" data-day="' + day.id + '" data-plan-id="' + plan.id + '">编辑交通</button></div>' + (leg.url ? '<a href="' + esc(leg.url) + '" target="_blank" rel="noopener noreferrer">估算 / 信息来源 ↗</a>' : '') + '<small>' + (leg.checkedDate ? '查阅于 ' + leg.checkedDate : '来源日期待补充') + '</small></div>';
}
function itineraryTransport(day) {
  if(!day.routePlans.length)return '';
  return '<details class="day-transport"><summary>交通与点位详情</summary>'+day.routePlans.map(plan=>'<section><h3>'+esc(plan.name)+'</h3>'+(plan.note?'<p class="plan-note">'+esc(plan.note)+'</p>':'')+'<div class="plan-stops">'+plan.stops.map(stop=>'<div>'+pointButton(stop,day,plan)+'<button class="text-button edit-point" data-edit-point="'+stop.id+'" data-day="'+day.id+'" data-plan-id="'+plan.id+'" aria-label="编辑点位 '+esc(stop.name)+'">编辑点位</button>'+(stop.note?'<p class="form-hint">'+esc(stop.note)+'</p>':'')+'</div>').join('')+'</div>'+plan.legs.map(leg=>legCard(day,plan,leg)).join('')+'</section>').join('')+'</details>';
}
function scrollMap() { if (!expanded) $('#route').scrollIntoView({behavior:'instant',block:'start'}); }
function showPlace(key, dayId, planId) {
  const place = planPlaces(state.days).find(p => p.key === key);
  if (!place || !map) return toast('该地点暂未定位。');
  const ref = place.refs.find(r => r.dayId === dayId && (!planId || r.planId === planId)) || place.refs[0];
  if (ref.planId) selectedPlans.set(ref.dayId, ref.planId);
  selectRoute(ref.dayId); map.setView(place.point,16,{animate:false}); drawMap();
  placeMarkers.get(key)?.openPopup(); scrollMap();
}
function showLeg(dayId, planId, legId) {
  const day = state.days.find(d => d.id === dayId), plan = day?.routePlans.find(p => p.id === planId), leg = plan?.legs.find(l => l.id === legId);
  if (!leg || !map) return;
  selectedPlans.set(day.id,plan.id); selectedDay = day.id; mapView='activities'; highlightedLeg=leg.id;
  renderRoutes(); drawMap();
  const from=plan.stops.find(s=>s.id===leg.from),to=plan.stops.find(s=>s.id===leg.to);
  const points=leg.road?.points || [from.point,to.point].filter(Boolean);
  if (points.length) {
    map.fitBounds(points,{padding:[65,65],maxZoom:16,animate:false});
    L.popup({maxWidth:330,maxHeight:290}).setLatLng(points[Math.floor(points.length/2)]).setContent('<div class="route-popup-summary"><strong>'+esc(from.name+' → '+to.name)+'</strong><p>'+esc(leg.mode+' · '+leg.duration)+'</p><button class="text-button" data-go-day="'+day.id+'">查看当日行程 ↗</button></div>').openOn(map);
  } else { toast('位置待补充，请在每日行程中查看交通详情。'); showDay(day.id); return; }
  scrollMap();
}
function revealItinerary(id) {
  const jump = () => {
    if (filter !== 'all') { filter='all'; document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('selected',b.dataset.filter==='all');b.setAttribute('aria-pressed',b.dataset.filter==='all');}); renderDays(); }
    const target = document.getElementById(id);
    if (!target) return;
    target.closest('details')?.setAttribute('open','');
    document.querySelectorAll('.jump-highlight').forEach(el=>el.classList.remove('jump-highlight'));
    target.classList.add('jump-highlight'); target.focus({preventScroll:true}); target.scrollIntoView({behavior:'instant',block:'center'});
    history.replaceState(null,'','#'+id);
  };
  if (expanded) { expandMap(false); requestAnimationFrame(jump); } else jump();
}
function showDay(dayId) { revealItinerary('day-'+dayId); }
function showEvent(dayId,eventId) { revealItinerary('event-'+dayId+'-'+eventId); }
function editLeg(dayId,planId,legId) {
  const leg=state.days.find(d=>d.id===dayId)?.routePlans.find(p=>p.id===planId)?.legs.find(l=>l.id===legId);
  if (!leg) return;
  openEditor('编辑这一段交通','<div class="form-grid">'+field('mode','交通方式',leg.mode,'text',false,true,80)+field('duration','建议预留 / 预计耗时',leg.duration,'text',false,false,120)+textArea('note','如何前往、接送与时间说明',leg.note,1500)+field('url','来源链接',leg.url,'url',true,false,2000)+field('checkedDate','查阅日期',leg.checkedDate,'date')+'</div>',form=>commit(s=>{const current=s.days.find(d=>d.id===dayId).routePlans.find(p=>p.id===planId).legs.find(l=>l.id===legId);const updated=Object.fromEntries(form);if(updated.mode!==current.mode)current.road=null;Object.assign(current,updated);}));
}
function editPlanPoint(dayId,planId,stopId) {
  const day=state.days.find(d=>d.id===dayId),plan=day?.routePlans.find(p=>p.id===planId),stop=plan?.stops.find(s=>s.id===stopId);
  if(!stop)return;
  draftStops=[{name:stop.name,point:stop.point}];
  openEditor('编辑路线点位','<p class="form-hint">位置变化会清除相邻道路估算和旧耗时，请重新核对交通。这里只修改当前预览方案中的点位。</p><div id="stop-list"></div><div id="picker-container" hidden><p class="picker-instruction" id="picker-instruction"></p><div id="picker-map"></div><button type="button" id="clear-pin" class="text-button">清除此站地图位置</button></div><div class="form-grid">'+textArea('note','点位说明',stop.note,1500)+field('url','位置来源',stop.url,'url',true,false,2000)+'</div>',form=>commit(s=>{const p=s.days.find(d=>d.id===dayId).routePlans.find(p=>p.id===planId),v=p.stops.find(s=>s.id===stopId);if(JSON.stringify(v.point)!==JSON.stringify(draftStops[0].point))p.legs.filter(l=>l.from===stopId||l.to===stopId).forEach(l=>{l.road=null;l.duration='点位已修改，耗时需重新核对';});Object.assign(v,draftStops[0],Object.fromEntries(form));}));
  renderStops();
}

function eventTravel(day,event) {
  const seen=new Set(),items=[];
  for(const plan of day.routePlans) for(const leg of plan.legs) {
    const to=plan.stops.find(s=>s.id===leg.to),from=plan.stops.find(s=>s.id===leg.from);
    if(!to.eventIds.includes(event.id))continue;
    const key=from.name+to.name+leg.mode+leg.duration;
    if(seen.has(key))continue; seen.add(key);
    items.push('<button class="text-button" data-leg="'+leg.id+'" data-day="'+day.id+'" data-plan-id="'+plan.id+'">'+esc(from.name+' → '+to.name)+'<small>'+esc(leg.mode+' · '+leg.duration)+' · '+esc(plan.name)+'</small></button>');
  }
  return items.length?'<div class="event-travel"><span>关联交通 · 点击看路线</span>'+items.join('')+'</div>':'';
}

document.addEventListener('click', async event => {
  const collapse = event.target.closest('[data-collapse-guide]');
  if (collapse) { const card = document.getElementById('guide-' + collapse.dataset.collapseGuide); card.open = false; card.querySelector('summary').focus(); card.scrollIntoView({ block:'start' }); return; }
  const button = event.target.closest('[data-copy-phrase]');
  if (!button) return;
  const phrase = state.guides.find(g => g.id === button.dataset.copyPhrase)?.sections[Number(button.dataset.section)]?.phrases[Number(button.dataset.phrase)];
  if (!phrase) return;
  try { await navigator.clipboard.writeText(phrase.en); toast('英文话术已复制'); }
  catch { toast('复制暂不可用，请长按或选中英文手动复制。'); }
});
