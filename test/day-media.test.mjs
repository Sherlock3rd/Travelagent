import test from 'node:test';
import assert from 'node:assert/strict';
import {blankState,validateState,mergeActivityPhotos} from '../public/model.js';
import {previewGeometry} from '../public/day-media.js';
const activity=(id,point,status='pending')=>({id,name:id,point,status,time:'',duration:'',transport:'',note:'',url:''});
const day=()=>({id:'day',date:'',stops:[{name:'start',point:[30,31]},{name:'end',point:[30.1,31.1]}],mode:'自驾',departure:'',arrival:'',duration:'',lodging:'',lodgingStatus:'pending',status:'pending',note:'',source:'',road:null,activities:[activity('a',[30,31]),activity('b',[30.1,31.1])],routePlans:[]});
const photo=()=>({url:'https://egymonuments.gov.eg/media/sample.jpg',title:'参考',caption:'环境照',sourceUrl:'https://egymonuments.gov.eg/',credit:'来源',checkedDate:'2026-09-24'});
test('图片增量只补指定安排，拒绝覆盖、名称漂移和不安全来源',()=>{
 const current=blankState();current.days=[day()];current.packing=[{id:'keep',name:'保留',category:'其他物品',done:true}];
 const patch={kind:'activityPhotos',schemaVersion:1,updates:[{id:'day',date:'',activities:[{id:'a',name:'a',photo:photo()}]}]};
 const result=mergeActivityPhotos(current,patch);assert.deepEqual(result.packing,current.packing);assert.deepEqual(result.days[0].activities[0].photo,photo());
 const comparison=structuredClone(result);comparison.days[0].activities[0].photo=null;assert.deepEqual(comparison,validateState(current));
 assert.throws(()=>mergeActivityPhotos(result,patch),/已有/);
 const bad=structuredClone(patch);bad.updates[0].activities[0].name='renamed';assert.throws(()=>mergeActivityPhotos(current,bad),/变化/);
 bad.updates[0].activities[0].name='a';bad.updates[0].activities[0].photo.url='https://evil.example/track';assert.throws(()=>mergeActivityPhotos(current,bad),/来源/);
});
test('小地图隔离备选方案且不跨未知坐标连线',()=>{
 const d=day();d.activities=[activity('a',[30,31]),activity('missing',null),activity('b',[30.1,31.1]),activity('optional',[30.2,31.2],'optional')];
 assert.equal(previewGeometry(d).paths.length,0);
 d.routePlans=[{id:'one',name:'A',stops:[{id:'a',point:[30,31],name:'a'},{id:'b',point:[30.1,31.1],name:'b'}],legs:[{from:'a',to:'b',mode:'步行',duration:'20 分'}]},{id:'two',name:'B',stops:[{id:'x',point:[40,41],name:'x'},{id:'y',point:null,name:'y'}],legs:[{from:'x',to:'y',mode:'待定',duration:''}]}];
 assert.equal(previewGeometry(d,'one').paths.length,1);assert.equal(previewGeometry(d,'two').paths.length,0);assert.equal(previewGeometry(d,'two').stops[0].name,'x');
});
test('相册补充保留封面与其他数据，重复导入和超量照片均拒绝',()=>{
 const current=blankState();current.days=[day()];current.days[0].activities[0].photo=photo();
 current.packing=[{id:'keep',name:'checked',category:'其他物品',done:true}];
 const extra={...photo(),url:'https://egymonuments.gov.eg/media/another.jpg'};
 const patch={kind:'activityPhotos',schemaVersion:1,updates:[{id:'day',date:'',activities:[{id:'a',name:'a',photos:[extra]}]}]};
 const result=mergeActivityPhotos(current,patch);
 assert.deepEqual(result.days[0].activities[0].photo,photo());assert.deepEqual(result.days[0].activities[0].photos,[extra]);
 const comparison=structuredClone(result);comparison.days[0].activities[0].photos=[];assert.deepEqual(comparison,validateState(current));
 assert.throws(()=>mergeActivityPhotos(result,patch),/已有/);
 const overflow=structuredClone(patch);overflow.updates[0].activities[0].photos=Array.from({length:9},(_,i)=>({...extra,url:extra.url+'?n='+i}));
 assert.throws(()=>mergeActivityPhotos(result,overflow),/最多/);
 const bad=structuredClone(patch);bad.updates[0].activities[0].photos=[null];assert.throws(()=>mergeActivityPhotos(current,bad),/不能为空/);
});
