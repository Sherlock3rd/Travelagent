import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadInitialTrip } from '../public/initial-trip.js';
import { migrateItalyChecklist, localTripClient } from '../public/trip-context.js';
import { validateState, STORAGE_KEY } from '../public/model.js';
const seed=JSON.parse(await readFile(new URL('../public/italy-trip.json',import.meta.url),'utf8'));
const key='travelagent.italy.workspace.v1';
test('意大利迁移旧勾选、独立保存与并发拒绝均不触碰埃及数据',async()=>{
  const values=new Map([[STORAGE_KEY,'unchanged Egypt'],['travelagent.italy.checklist.v1','{"1":true}']]);
  const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  const initial=await loadInitialTrip(storage,async()=>migrateItalyChecklist(structuredClone(seed),{1:true}),key);
  assert.equal(initial.state.packing[1].done,true);
  const client=localTripClient(storage,key),base=initial.state,next=structuredClone(base);next.revision++;next.packing[0].done=true;
  await client.save(base,next,0);
  await assert.rejects(client.save(base,{...base,revision:1},0),/另一页面/);
  assert.equal(values.get(STORAGE_KEY),'unchanged Egypt');
  const again=await loadInitialTrip(storage,()=>{throw Error('must preserve edits');},key);assert.equal(again.state.packing[0].done,true);
});
test('新行程含可关联的地图、每日相册和独立备选；本地照片拒绝任意路径',()=>{
  const state=validateState(seed);assert.equal(state.days.length,10);
  assert.equal(state.days.flatMap(d=>d.activities).filter(a=>a.status==='optional').length,7);
  for(const day of state.days.slice(1,8))assert.ok(day.activities.some(a=>a.photo),day.id);
  assert.equal(state.days[4].stops.at(-1).point,null);
  const day=state.days[6];assert.equal(day.routePlans.length,3);
  const primaryEvents=day.routePlans[0].stops.flatMap(s=>s.eventIds);
  assert.ok(!primaryEvents.some(id=>id.startsWith('italy-option-')));
  for(const url of ['../private/source.jpg','media/italy/../../source.jpg','//evil.test/a.jpg']){
    const bad=structuredClone(seed);bad.days[1].activities.find(a=>a.photo).photo.url=url;
    assert.throws(()=>validateState(bad));
  }
});
