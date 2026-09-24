import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, validateState, mergeGuides } from '../public/model.js';
import { guideHTML } from '../public/guides.js';
const guide = () => ({id:'sample',title:'测试指南',category:'其他攻略',body:'正文',url:'',checkedDate:'',sections:[{title:'步骤',steps:[{title:'先核对',body:'再操作'}],phrases:[{en:'Please check.',zh:'请检查'}],images:[{url:'https://dohahamadairport.com/example.jpg',alt:'示例',caption:'测试',sourceUrl:'https://example.com/'}]}]});
test('图文攻略增量导入保留原数据、旧格式及勾选，拒绝重复覆盖',()=>{
  const current=blankState(); current.packing=[{id:'keep',name:'已装包',category:'其他物品',done:true}];
  current.guides=[{id:'old',title:'旧格式',category:'交通出行',body:'用户自己的文字',url:'',checkedDate:''}];
  const patch={schemaVersion:1,kind:'guidesAppend',guides:[guide()]}, before=validateState(current), next=mergeGuides(current,patch);
  assert.deepEqual({...next,guides:next.guides.slice(1)},before);
  assert.deepEqual(validateState(next),next);
  assert.throws(()=>mergeGuides(next,patch),/已存在/);
  assert.equal(next.guides[1].sections.length,0);
});
test('攻略拒绝危险链接、非白名单图片与超量内容',()=>{
  const state=blankState();state.guides=[guide()];
  for(const url of ['javascript:alert(1)','http://dohahamadairport.com/a.jpg','https://evil.example/a.jpg','https://dohahamadairport.com:8080/a.jpg']) {
    state.guides[0].sections[0].images[0].url=url;
    assert.throws(()=>validateState(state));
  }
  state.guides=[guide()];state.guides[0].sections[0].links=[{label:'bad',url:'data:text/html,bad'}];assert.throws(()=>validateState(state));
  state.guides=[guide()];state.guides[0].sections=Array(25).fill({title:'x'});assert.throws(()=>validateState(state));
});
test('攻略 HTML 转义所有富文本字段，不将正文当 HTML 执行',()=>{
  const g=guide();g.sections[0].title='<img src=x onerror=alert(1)>';g.sections[0].phrases[0].en='<script>alert(1)</script>';
  const state=blankState();state.guides=[g];
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const html=guideHTML(validateState(state).guides[0],escape);
  assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('referrerpolicy="no-referrer"'));
});
