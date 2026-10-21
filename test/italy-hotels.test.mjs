import test from 'node:test';
import assert from 'node:assert/strict';
import { hotelUpdate } from '../public/italy-hotels-update.js';
import { applyContentUpdate, mergeContentUpdate } from '../public/content-update.js';
import { blankState, validateState } from '../public/model.js';
const key='travelagent.italy.workspace.v1';
const memory=value=>{const data=new Map([[key,JSON.stringify(value)],['travelagent.workspace.v1','Egypt untouched']]);return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
test('7 晚酒店落点与次日出发连续，市区游览和独立备选均保留',()=>{
  const state=validateState(hotelUpdate.after);
  for(let i=1;i<=7;i++){
    const d=state.days[i];assert.equal(d.lodgingStatus,'confirmed');assert.equal(d.status,'pending');
    assert.deepEqual(d.stops.at(-1),state.days[i+1].stops[0]);
    assert.deepEqual(d.stops.at(-1).point,d.activities.find(a=>a.id===d.id+'-hotel').point);
  }
  assert.match(state.days[1].lodging,/Grand Hotel Serapide/);
  assert.match(state.days[4].stops.at(-1).name,/卡尔皮/);
  assert.match(state.days[6].stops[1].name,/米兰大教堂/);
  assert.match(state.days[6].lodging,/皮斯托亚/);
  assert.match(state.days[8].stops[0].name,/蒂沃利温泉区/);
  assert.equal(state.days.flatMap(d=>d.activities).filter(a=>a.status==='optional').length,7);
});
test('既有浏览器自动补齐酒店且保留勾选、留言、编辑与更新前备份',()=>{
  const old=structuredClone(hotelUpdate.before);old.revision=6;old.packing[5].done=true;old.days[0].note='我的改动';
  old.notes.push({id:'personal-note',body:'自用留言',author:'我',createdAt:'2026-10-21T00:00:00Z'});
  const storage=memory(old),result=applyContentUpdate(storage,key,hotelUpdate);
  assert.equal(result.conflicts.length,0);assert.equal(result.state.revision,7);
  assert.equal(result.state.packing[5].done,true);assert.equal(result.state.days[0].note,'我的改动');
  assert.deepEqual(result.state.notes,old.notes);
  assert.equal(result.state.days.filter(d=>d.lodgingStatus==='confirmed').length,7);
  assert.equal(storage.getItem('travelagent.workspace.v1'),'Egypt untouched');
  assert.deepEqual(JSON.parse(storage.getItem(key+'.update.'+hotelUpdate.id+'.backup')),old);
  assert.equal(applyContentUpdate(storage,key,hotelUpdate).changed,false);
  const edited=JSON.parse(storage.getItem(key));edited.days[1].lodging='自己的新酒店';storage.setItem(key,JSON.stringify(edited));
  assert.equal(applyContentUpdate(storage,key,hotelUpdate).state.days[1].lodging,'自己的新酒店');
});
test('用户已改酒店或活动不被覆盖，独立项仍合并，原日程删除不复活',()=>{
  const old=structuredClone(hotelUpdate.before);old.days[1].lodging='自己的预订';old.days[1].lodgingStatus='confirmed';
  old.days[3].activities[0].note='自己的发车安排';old.days.splice(4,1);
  const result=mergeContentUpdate(old,hotelUpdate);
  assert.equal(result.state.days[1].lodging,'自己的预订');assert.equal(result.state.days[1].lodgingStatus,'confirmed');
  assert.equal(result.state.days[3].activities[0].note,'自己的发车安排');
  assert.ok(result.conflicts.length);assert.ok(result.state.guides.some(g=>g.id==='italy-guide-hotels-20261021'));
  assert.ok(!result.state.days.some(d=>d.id==='italy-d5'));
  assert.equal(mergeContentUpdate(blankState(),hotelUpdate).changed,false);
});
test('新浏览器已是新资料时不重复新增；备份失败或并发写入时保留原文',()=>{
  assert.equal(mergeContentUpdate(hotelUpdate.after,hotelUpdate).changed,false);
  const storage=memory(hotelUpdate.before),raw=storage.getItem(key);
  storage.setItem=()=>{throw Error('quota');};assert.throws(()=>applyContentUpdate(storage,key,hotelUpdate),/quota/);
  assert.equal(storage.getItem(key),raw);
  const raced=memory(hotelUpdate.before),write=raced.setItem;
  raced.setItem=(k,v)=>{write(k,v);if(k.endsWith('.backup'))write(key,'newer content');};
  assert.throws(()=>applyContentUpdate(raced,key,hotelUpdate),/另一页面/);assert.equal(raced.getItem(key),'newer content');
});
