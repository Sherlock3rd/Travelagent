import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState } from '../public/model.js';
import { mergeCloudDocuments, cloudClient } from '../public/cloud-sync.js';
const copy=x=>structuredClone(x);
const base=()=>({...blankState(),packing:[{id:'a',name:'A',category:'其他物品',done:false},{id:'b',name:'B',category:'其他物品',done:false}]});
test('两台设备改动不同清单项自动合并，保留服务器新版本',()=>{
  const b=base(),l=copy(b),r=copy(b);l.packing[0].done=true;r.packing[1].done=true;r.revision=8;
  const result=mergeCloudDocuments(b,l,r);assert.ok(result.packing.every(x=>x.done));assert.equal(result.revision,8);
});
test('同一字段冲突和删除对方正在编辑的条目均拒绝覆盖',()=>{
  const b=base(),l=copy(b),r=copy(b);l.packing[0].name='Local';r.packing[0].name='Remote';
  assert.throws(()=>mergeCloudDocuments(b,l,r),/conflict/);
  l.packing.shift();assert.throws(()=>mergeCloudDocuments(b,l,r),/conflict/);
});
test('并发新增、删除不相关项和单方排序保留',()=>{
  const b=base(),l=copy(b),r=copy(b);l.packing.push({id:'c',name:'C',category:'其他物品',done:false});r.packing.shift();
  assert.deepEqual(mergeCloudDocuments(b,l,r).packing.map(x=>x.id),['b','c']);
  const reordered=copy(b);reordered.packing.reverse();const edited=copy(b);edited.packing[0].done=true;
  assert.deepEqual(mergeCloudDocuments(b,reordered,edited).packing.map(x=>x.id),['b','a']);
});
test('CAS 冲突后合并重试，不盲目上传旧整份数据',async()=>{
  const b=base(),l=copy(b),remote=copy(b);l.packing[0].done=true;remote.packing[1].done=true;remote.revision=1;let calls=0;
  const client=cloudClient(async(url,options)=>{calls++;const p=JSON.parse(options.body);
    if(calls===1)return new Response(JSON.stringify({version:1,document:remote}),{status:409});
    assert.equal(p.expectedVersion,1);assert.ok(p.document.packing.every(x=>x.done));p.document.revision=2;
    return new Response(JSON.stringify({version:2,document:p.document}));
  });
  const result=await client.save(b,l,0);assert.equal(result.version,2);assert.equal(calls,2);
});
test('网络重试复用请求编号，避免重复写入；服务器未确认不报成功',async()=>{
  const bodies=[];const b=base();
  const client=cloudClient(async(url,options)=>{bodies.push(options.body);if(bodies.length===1)throw new Error('Network');return new Response(JSON.stringify({version:0,document:b}));});
  await client.save(b,b,0);assert.equal(bodies[0],bodies[1]);
  const unavailable=cloudClient(async()=>new Response('{}',{status:503}));await assert.rejects(unavailable.save(b,b,0));
});
test('版本轮询支持 304 并拒绝不一致的云端文档',async()=>{
  const client=cloudClient(async(url,options)=>{assert.equal(options.headers['If-None-Match'],'"3"');return new Response(null,{status:304});});
  assert.equal(await client.read(3),null);
  const invalid=cloudClient(async()=>new Response(JSON.stringify({version:8,document:base()})));await assert.rejects(invalid.read(),/版本不一致/);
});
