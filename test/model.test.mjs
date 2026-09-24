import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, validateState, routeSignature, dayForSave } from '../public/model.js';

const day = () => ({ id: 'test-day', date: '', stops: [{ name: '测试起点', point: [30, 110] }, { name: '测试终点', point: [31, 111] }], mode: '自驾', departure: '', arrival: '', duration: '', lodging: '', lodgingStatus: 'pending', status: 'pending', source: '', note: '', road: null });
test('空白项目不包含示例行程或自动确认', () => {
  assert.deepEqual(validateState(blankState()), blankState());
  const s = blankState(); s.days.push(day());
  assert.equal(validateState(s).days[0].status, 'pending');
  s.days[0].lodgingStatus = 'confirmed';
  assert.throws(() => validateState(s), /住宿地点/);
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
