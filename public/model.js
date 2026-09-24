export const STORAGE_KEY = 'travelagent.workspace.v1';
export const COLORS = ['#a66d4c', '#728c55', '#558d92', '#866b9e', '#b89246', '#59789e', '#9c6479'];
export const CATEGORIES = ['证件资料', '衣物洗护', '电子设备', '健康用品', '其他物品'];
export const MODES = ['待定', '自驾', '大巴', '火车', '飞机', '步行', '其他'];
export const GUIDE_CATEGORIES = ['交通出行', '餐饮美食', '景点预约', '住宿信息', '当地提醒', '其他攻略'];
export function blankState() {
  return { schemaVersion: 1, revision: 0, trip: { title: '我的旅行计划', destination: '', startDate: '', endDate: '' }, days: [], packing: [], notes: [], guides: [] };
}
const str = (value, max = 4000) => {
  if (typeof value !== 'string' || value.length > max) throw new Error('文字字段缺失或超出长度限制。');
  return value.trim();
};
const id = value => {
  if (typeof value !== 'string' || !/^[\w-]{1,80}$/.test(value)) throw new Error('记录编号无效。');
  return value;
};
const choice = (value, allowed) => {
  if (!allowed.includes(value)) throw new Error('记录包含未知选项。');
  return value;
};
export function validDate(value) {
  if (value === '') return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('日期格式无效。');
  return value;
}
const time = value => {
  if (value !== '' && (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))) throw new Error('时间格式无效。');
  return value;
};
const boolean = value => { if (typeof value !== 'boolean') throw new Error('勾选状态无效。'); return value; };
export function coordinates(value) {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isFinite) || Math.abs(value[0]) > 90 || Math.abs(value[1]) > 180) throw new Error('地图位置无效。');
  return [...value];
}
export function safeURL(value) {
  if (!value) return '';
  const parsed = new URL(value);
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('来源链接须为 http 或 https 网页。');
  return parsed.href;
}
const rows = (value, parse, max = 500) => {
  if (!Array.isArray(value) || value.length > max) throw new Error('记录数量超出限制。');
  const result = value.map(parse);
  if (new Set(result.map(row => row.id)).size !== result.length) throw new Error('记录编号重复。');
  return result;
};
export const routeSignature = day => JSON.stringify({ mode: day.mode, stops: day.stops });
export function validateState(raw) {
  if (!raw || raw.schemaVersion !== 1 || !raw.trip) throw new Error('这不是受支持的 Travelagent 备份。');
  const trip = { title: str(raw.trip.title, 80), destination: str(raw.trip.destination, 120), startDate: validDate(raw.trip.startDate), endDate: validDate(raw.trip.endDate) };
  if (!trip.title) throw new Error('请填写旅行名称。');
  if (trip.endDate && trip.startDate && trip.endDate < trip.startDate) throw new Error('结束日期不能早于出发日期。');
  const days = rows(raw.days, d => {
    if (!Array.isArray(d.stops) || d.stops.length < 2 || d.stops.length > 20) throw new Error('每天需要 2–20 个站点。');
    const stops = d.stops.map(s => ({ name: str(s.name, 120), point: coordinates(s.point) }));
    if (stops.some(s => !s.name)) throw new Error('请填写每个站点名称。');
    const day = { id: id(d.id), date: validDate(d.date), stops, mode: choice(d.mode, MODES), departure: time(d.departure), arrival: time(d.arrival), duration: str(d.duration, 80), lodging: str(d.lodging, 200), lodgingStatus: choice(d.lodgingStatus, ['pending', 'confirmed']), status: choice(d.status, ['pending', 'confirmed']), note: str(d.note), source: str(d.source, 500), road: null };
    if (day.lodgingStatus === 'confirmed' && !day.lodging) throw new Error('确认住宿前请填写住宿地点。');
    if (d.road) {
      const r = d.road;
      if (!['自驾', '大巴'].includes(day.mode) || !day.stops.every(s => s.point)) throw new Error('公路规划与行程站点不一致。');
      if (r.signature !== routeSignature(day) || !Array.isArray(r.points) || r.points.length < 2 || r.points.length > 20000 || !Number.isFinite(r.distance) || r.distance < 0 || !Number.isFinite(r.duration) || r.duration < 0) throw new Error('公路规划数据无效或已过期。');
      day.road = { signature: r.signature, points: r.points.map(p => { const point = coordinates(p); if (!point) throw new Error('公路坐标无效。'); return point; }), distance: r.distance, duration: r.duration, checkedAt: str(r.checkedAt, 50) };
    }
    return day;
  }, 120);
  return {
    schemaVersion: 1, revision: Number.isSafeInteger(raw.revision) && raw.revision >= 0 ? raw.revision : 0, trip, days,
    packing: rows(raw.packing, p => ({ id: id(p.id), name: str(p.name, 120), category: choice(p.category, CATEGORIES), done: boolean(p.done) })),
    notes: rows(raw.notes, n => ({ id: id(n.id), body: str(n.body), author: str(n.author, 40), createdAt: str(n.createdAt, 50) })),
    guides: rows(raw.guides, g => ({ id: id(g.id), title: str(g.title, 120), category: choice(g.category, GUIDE_CATEGORIES), body: str(g.body, 8000), url: safeURL(str(g.url, 2000)), checkedDate: validDate(g.checkedDate) }))
  };
}
export function dayForSave(original, updated) {
  const changed = original && JSON.stringify({ ...original, road: null, status: null }) !== JSON.stringify({ ...updated, road: null, status: null });
  return { ...updated, road: original && routeSignature(original) === routeSignature(updated) ? original.road : null, status: updated.status, changed: Boolean(changed) };
}
