import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { previewGeometry } from '../public/day-media.js';
import { applyContentUpdate, mergeContentUpdate } from '../public/content-update.js';
import { hotelUpdate } from '../public/italy-hotels-update.js';
import { flightUpdate } from '../public/italy-flights-update.js';
const seed=JSON.parse(await readFile(new URL('../public/italy-trip.json',import.meta.url),'utf8'));
test('跨日航班连接已知机场，D1 集合与 D2 起飞日期不混淆',()=>{
  const outbound=previewGeometry(seed.days[0]);
  assert.equal(outbound.paths.length,1);assert.match(outbound.paths[0].label,/飞机.*3U3895.*10.22/);
  assert.deepEqual(outbound.paths[0].points.at(-1),seed.days[1].stops[0].point);
  assert.deepEqual(seed.days[0].activities,hotelUpdate.after.days[0].activities);
  assert.deepEqual(seed.days[1],hotelUpdate.after.days[1]);
  assert.match(seed.days[0].routePlans[0].note,/D1（10.21）.*集合.*D2（10.22）01:40/);
  const inbound=previewGeometry(seed.days[8]);
  assert.equal(inbound.paths.length,2);assert.match(inbound.paths.at(-1).label,/飞机.*3U3896/);
  assert.deepEqual(inbound.paths.at(-1).points.at(-1),seed.days[9].stops[0].point);
  assert.ok([...outbound.paths,...inbound.paths].every(p=>!p.road));
});
test('既有酒店缓存增量补航线且新浏览器两次更新均不修改新种子',()=>{
  const existing=structuredClone(hotelUpdate.after);existing.packing[0].done=true;existing.days[1].note='用户备注';
  const result=mergeContentUpdate(existing,flightUpdate);
  assert.equal(result.conflicts.length,0);assert.equal(result.state.packing[0].done,true);
  assert.equal(result.state.days[1].note,'用户备注');assert.equal(previewGeometry(result.state.days[0]).paths.length,1);
  const values=new Map([['italy',JSON.stringify(seed)]]),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  assert.equal(applyContentUpdate(storage,'italy',hotelUpdate).changed,false);
  assert.equal(applyContentUpdate(storage,'italy',flightUpdate).changed,false);
  assert.deepEqual(JSON.parse(values.get('italy')),seed);
});
test('旧本机路线自定义坐标发生冲突时保留，删除的 D1 不恢复',()=>{
  const custom=structuredClone(hotelUpdate.after);custom.days[0].stops[1]={name:'自定义目的地',point:[32,110]};
  const result=mergeContentUpdate(custom,flightUpdate);
  assert.deepEqual(result.state.days[0].stops,custom.days[0].stops);assert.ok(result.conflicts.includes('italy-d1 / stops'));
  custom.days.shift();assert.ok(!mergeContentUpdate(custom,flightUpdate).state.days.some(d=>d.id==='italy-d1'));
});
