import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const root=new URL('../',import.meta.url);
execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root,stdio:'pipe'});
const code=await readFile(new URL('../dist/sw.js',import.meta.url),'utf8');
const manifest=JSON.parse(/^const PRECACHE = (.*);$/m.exec(code)[1]);
const origin='https://example.test/Travelagent/';
function harness(fail=false) {
  const handlers={}, buckets=new Map(); let online=true,claimed=false,skip=false;
  const absolute=x=>typeof x==='string'?x:x.url;
  const caches={async keys(){return [...buckets.keys()];},async open(name){
    if(!buckets.has(name))buckets.set(name,new Map());const data=buckets.get(name);
    return {async addAll(requests){
      if(fail)throw new Error('interrupted download');
      const values=await Promise.all(requests.map(async r=>[absolute(r),await readFile(new URL('../dist/'+(new URL(absolute(r)).pathname.split('/Travelagent/')[1]||'index.html'),import.meta.url),'utf8')]));
      for(const [url,body] of values)data.set(url,body);
    },async match(r,options){const url=absolute(r);if(data.has(url))return data.get(url);if(options?.ignoreSearch){for(const [key,value] of data)if(key.split('?')[0]===url.split('?')[0])return value;}}};
  }};
  vm.runInNewContext(code,{URL,Request,Set,Promise,caches,fetch:async()=>{if(!online)throw new Error('offline');return 'network';},self:{location:{href:origin+'sw.js'},clients:{async claim(){claimed=true;}},async skipWaiting(){skip=true;},addEventListener(type,fn){handlers[type]=fn;}}});
  const lifecycle=async name=>{let pending;handlers[name]({waitUntil(p){pending=p;}});await pending;};
  return {caches,buckets,lifecycle,goOffline(){online=false;},get claimed(){return claimed;},get skip(){return skip;},async get(path,method='GET'){
    let response;handlers.fetch({request:{url:new URL(path,origin).href,method},respondWith(p){response=p;}});return response?await response:undefined;
  },async status(){let result,pending;handlers.message({data:{type:'OFFLINE_STATUS'},ports:[{postMessage(value){result=value;}}],waitUntil(p){pending=p;}});await pending;return result;}};
}
test('发布资源图覆盖三个页面和精确版本依赖；子目录离线首次打开可用',async()=>{
  const h=harness();await h.lifecycle('install');await h.lifecycle('activate');h.goOffline();
  assert.equal(h.claimed,true);assert.equal(h.skip,false);
  for(const path of ['./','index.html','italy.html','trip.html'])assert.match(await h.get(path),/Travelagent/);
  for(const path of manifest){assert.ok(await h.get(path),path);}
  for(const path of ['index.html','italy.html','trip.html']){
    const html=await h.get(path);for(const match of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css)\?v=[^"]+)"/g))assert.ok(await h.get(match[1]),match[1]);
  }
  const italy=await h.get('italy.html');assert.match(italy,/app.js\?v=/);
  const entry=await h.get(manifest.find(x=>x.startsWith('app.js?v=')));
  for(const match of entry.matchAll(/from '([^']+)'/g))assert.ok(await h.get(match[1]),match[1]);
  assert.match(await h.get('italy-trip.json'),/10.27/);
  assert.ok(await h.get('italy-geography.json'));
  for(const key of ['rome','milan','civita','pompeii','venice','pisa','florence'])assert.ok(await h.get('media/italy/'+key+'.jpg'));
  assert.equal((await h.status()).ready,true);
});
test('不接管云同步、私有路径或写操作；缓存缺项不误报就绪',async()=>{
  const h=harness();await h.lifecycle('install');h.goOffline();
  for(const path of ['private/italy-source.txt','.env','https://xqardnobmoaxosjqwiwh.supabase.co/functions/v1/travel-sync'])assert.equal(await h.get(path),undefined);
  assert.equal(await h.get('italy.html','POST'),undefined);
  const bucket=[...h.buckets.values()][0];bucket.delete(origin+'italy.html');
  assert.equal((await h.status()).ready,false);
});
test('安装失败保留既有缓存；旧标签页的精确版本仍可读取',async()=>{
  const h=harness(true);h.buckets.set('travelagent-shell-older',new Map([[origin+'app.js?v=older','old module']]));
  await assert.rejects(h.lifecycle('install'),/interrupted/);
  h.goOffline();assert.equal(await h.get('app.js?v=older'),'old module');assert.equal((await h.status()).ready,false);
  assert.ok(h.buckets.has('travelagent-shell-older'));
});
