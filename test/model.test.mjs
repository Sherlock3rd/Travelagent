import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, validateState, routeSignature, dayForSave, mergeDayActivities, activitySegments } from '../public/model.js';

const day = () => ({ id: 'test-day', date: '', stops: [{ name: '测试起点', point: [30, 110] }, { name: '测试终点', point: [31, 111] }], mode: '自驾', departure: '', arrival: '', duration: '', lodging: '', lodgingStatus: 'pending', status: 'pending', source: '', note: '', road: null });
test('空白项目不包含示例行程或自动确认', () => {
  assert.deepEqual(validateState(blankState()), blankState());
  const s = blankState(); s.days.push(day());
  assert.equal(validateState(s).days[0].status, 'pending');
  s.days[0].lodgingStatus = 'confirmed';
  assert.throws(() => validateState(s), /住宿地点/);
});
const activity = (id, point = [30, 110], status = 'pending') => ({ id, name: '测试景点', point, status, time: '上午（建议）', duration: '', transport: '', note: '', url: '' });
test('旧备份兼容，补充当日安排只改指定日期并保护已有编辑', () => {
  const s = blankState(); delete s.trip.countryCode; s.days.push(day());
  s.packing.push({ id: 'p', name: '证件', category: '证件资料', done: true });
  s.notes.push({ id: 'n', author: '', body: '保留留言', createdAt: '' });
  const before = validateState(s);
  assert.deepEqual(before.days[0].activities, []);
  const patch = { kind: 'dayActivities', schemaVersion: 1, countryCode: 'EGY', updates: [{ id: 'test-day', date: '', activities: [activity('a')] }] };
  const after = mergeDayActivities(s, patch);
  assert.deepEqual(after.packing, before.packing); assert.deepEqual(after.notes, before.notes); assert.deepEqual(after.guides, before.guides);
  assert.deepEqual({ ...after.days[0], activities: [] }, before.days[0]);
  assert.equal(after.trip.countryCode, 'EGY'); assert.equal(s.days[0].activities, undefined);
  assert.throws(() => mergeDayActivities(after, patch), /已有当日安排/);
  assert.throws(() => mergeDayActivities(s, { ...patch, updates: [{ ...patch.updates[0], date: '2026-10-01' }] }), /不匹配/);
  assert.throws(() => mergeDayActivities(s, { ...patch, updates: [...patch.updates, ...patch.updates] }), /重复/);
  const edited = dayForSave(after.days[0], { ...after.days[0], note: '改交通备注' });
  assert.deepEqual(edited.activities, after.days[0].activities);
});
test('备选和未知地点打断日内路线，确认状态与整天行程独立', () => {
  const a = [activity('a'), activity('b', [31, 111]), activity('c', [32, 112], 'optional'), activity('d', [33, 113]), activity('e', null), activity('f', [34, 114]), activity('g', [35, 115])];
  assert.deepEqual(activitySegments(a), [[[30, 110], [31, 111]], [[34, 114], [35, 115]]]);
  const s = blankState(); s.days.push({ ...day(), status: 'confirmed', activities: a });
  assert.equal(validateState(s).days[0].activities[0].status, 'pending');
  s.days[0].activities[0].url = 'javascript:alert(1)';
  assert.throws(() => validateState(s), /http/);
  s.days[0].activities[0].url = ''; s.days[0].activities.push(activity('a'));
  assert.throws(() => validateState(s), /重复/);
});
test('修改站点或交通方式后清除旧公路估算，备注修改保留路线', () => {
  const original = day();
  original.road = { signature: routeSignature(original), points: [[30, 110], [31, 111]], duration: 100, distance: 1000, checkedAt: '2026-09-24' };
  assert.deepEqual(dayForSave(original, { ...original, note: '新备注' }).road, original.road);
  const changed = structuredClone(original); changed.stops[1].point = [32, 112];
  assert.equal(dayForSave(original, changed).road, null);
  assert.equal(dayForSave(original, { ...original, mode: '火车' }).road, null);
  const s = blankState(); s.days.push(changed);
  assert.throws(() => validateState(s), /过期/);
});
test('导入拒绝危险来源链接、无效日期、越界坐标和重复编号', () => {
  const s = blankState();
  s.guides.push({ id: 'g', title: '测试', category: '其他攻略', body: '', url: 'javascript:alert(1)', checkedDate: '' });
  assert.throws(() => validateState(s), /http/);
  s.guides = []; s.trip.startDate = '2026-02-30';
  assert.throws(() => validateState(s), /日期/);
  s.trip.startDate = ''; s.days.push(day()); s.days[0].stops[0].point = [99, 110];
  assert.throws(() => validateState(s), /地图位置/);
  s.days = [day(), day()];
  assert.throws(() => validateState(s), /重复/);
});
test('备份保留清单勾选、确认状态与留言，舍弃未声明字段', () => {
  const s = blankState(); s.days.push({ ...day(), status: 'confirmed', lodging: '测试酒店', lodgingStatus: 'confirmed' });
  s.packing.push({ id: 'p', name: '测试充电器', category: '电子设备', done: true });
  s.notes.push({ id: 'n', author: '测试', body: '<script>text only</script>', createdAt: '2026-09-24T00:00:00Z' });
  s.unknown = 'discard';
  const result = validateState(JSON.parse(JSON.stringify(s)));
  assert.equal(result.packing[0].done, true);
  assert.equal(result.days[0].status, 'confirmed');
  assert.equal(result.notes[0].body, s.notes[0].body);
  assert.equal(result.unknown, undefined);
});
