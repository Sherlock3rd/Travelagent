// Route previews are separate from bookings and activity confirmation.
const text = (s, max = 1500) => { if (typeof s !== 'string' || s.length > max) throw Error('路线文字字段无效。'); return s.trim(); };
const id = s => { if (typeof s !== 'string' || !/^[\w-]{1,80}$/.test(s)) throw Error('路线编号无效。'); return s; };
const list = (items, max, parse) => {
  if (!Array.isArray(items) || items.length > max) throw Error('路线记录数量无效。');
  const result = items.map(parse);
  if (new Set(result.map(x => x.id)).size !== result.length) throw Error('路线编号重复。');
  return result;
};
export const legSignature = (plan, leg) => JSON.stringify({ mode: leg.mode, from: plan.stops.find(s => s.id === leg.from)?.point, to: plan.stops.find(s => s.id === leg.to)?.point });
export function parsePlans(raw, activities, { coordinates, safeURL, validDate }) {
  return list(raw ?? [], 8, p => {
    const plan = { id: id(p.id), name: text(p.name, 120), note: text(p.note ?? ''), stops: [], legs: [] };
    if (!plan.name) throw Error('路线方案需要名称。');
    plan.stops = list(p.stops, 40, s => {
      const eventIds = s.eventIds ?? [];
      if (!Array.isArray(eventIds) || eventIds.length > 40 || new Set(eventIds).size !== eventIds.length || eventIds.some(e => !activities.some(a => a.id === e))) throw Error('点位关联的事件不存在或重复。');
      const stop = { id: id(s.id), name: text(s.name, 120), point: coordinates(s.point), eventIds, note: text(s.note ?? ''), url: safeURL(text(s.url ?? '', 2000)) };
      if (!stop.name) throw Error('点位需要名称。');
      return stop;
    });
    plan.legs = list(p.legs, 60, l => {
      const from = plan.stops.find(s => s.id === l.from), to = plan.stops.find(s => s.id === l.to);
      if (!from || !to || from.id === to.id) throw Error('路段起终点关联无效。');
      const leg = { id: id(l.id), from: from.id, to: to.id, mode: text(l.mode, 80), duration: text(l.duration, 120), note: text(l.note ?? ''), url: safeURL(text(l.url ?? '', 2000)), checkedDate: validDate(l.checkedDate ?? ''), road: null };
      if (l.road) {
        const r = l.road;
        if (!from.point || !to.point || r.signature !== legSignature(plan, leg)) throw Error('分段道路与点位不一致，请重新计算。');
        if (!Array.isArray(r.points) || r.points.length < 2 || r.points.length > 10000 || !Number.isFinite(r.duration) || r.duration < 0 || !Number.isFinite(r.distance) || r.distance < 0) throw Error('分段道路估算无效。');
        const points = r.points.map(p => { const c = coordinates(p); if (!c) throw Error('道路坐标无效。'); return c; });
        // Reject unrelated geometry, allowing at most 600 m of routing snap at a POI.
        if (metres(from.point, points[0]) > 600 || metres(to.point, points.at(-1)) > 600) throw Error('道路偏离点位，请核对出入口。');
        leg.road = { signature: r.signature, points, duration: r.duration, distance: r.distance };
      }
      return leg;
    });
    return plan;
  });
}
function metres(a, b) {
  const rad = Math.PI / 180, lat = (a[0] + b[0]) * rad / 2;
  return Math.hypot((a[0] - b[0]) * rad, (a[1] - b[1]) * rad * Math.cos(lat)) * 6371000;
}
export function planPlaces(days) {
  const places = new Map();
  const add = (day, stop, planId = '') => {
    if (!stop.point) return;
    const key = stop.point.map(n => n.toFixed(5)).join(',');
    if (!places.has(key)) places.set(key, { key, name: stop.name, point: stop.point, refs: [] });
    places.get(key).refs.push({ dayId: day.id, planId, stopId: stop.id, eventIds: stop.eventIds || [stop.id], note: stop.note || '', url: stop.url || '' });
  };
  for (const day of days) {
    for (const plan of day.routePlans || []) for (const stop of plan.stops) add(day, stop, plan.id);
    for (const a of day.activities) if (!(day.routePlans || []).some(p => p.stops.some(s => s.eventIds.includes(a.id) && s.point))) add(day, a);
  }
  return [...places.values()];
}
export function forgetEvent(plans, eventId) {
  for (const plan of plans) for (const stop of plan.stops) stop.eventIds = stop.eventIds.filter(id => id !== eventId);
}
