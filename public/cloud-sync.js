import { validateState } from './model.js';
export const CLOUD_ENDPOINT = 'https://xqardnobmoaxosjqwiwh.supabase.co/functions/v1/travel-sync';
export const RECOVERY_KEY = 'travelagent.cloud-recovery.v1';
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const keyed = a => Array.isArray(a) && a.every(x => object(x) && typeof x.id === 'string') && new Set(a.map(x=>x.id)).size === a.length;

export function mergeCloudDocuments(base, local, remote) {
  function merge(b,l,r,path) {
    if (path === 'revision') return r;
    if (same(l,r)) return l;
    if (same(l,b)) return r;
    if (same(r,b)) return l;
    if (object(b) && object(l) && object(r)) {
      const out={};
      for(const k of new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)])) {
        const v=merge(b[k],l[k],r[k],path?path+'.'+k:k); if(v!==undefined)out[k]=v;
      }
      return out;
    }
    if (keyed(b) && keyed(l) && keyed(r)) {
      const bm=new Map(b.map(x=>[x.id,x])),lm=new Map(l.map(x=>[x.id,x])),rm=new Map(r.map(x=>[x.id,x]));
      const common=b.filter(x=>lm.has(x.id)&&rm.has(x.id)).map(x=>x.id);
      const lo=l.map(x=>x.id).filter(id=>common.includes(id)),ro=r.map(x=>x.id).filter(id=>common.includes(id));
      if(!same(lo,common)&&!same(ro,common)&&!same(lo,ro))throw new Error('conflict:'+path);
      const order=!same(lo,common)?[...l,...r]:[...r,...l];
      const ids=[...new Set([...order,...b].map(x=>x.id))],out=[];
      for(const id of ids){const value=merge(bm.get(id),lm.get(id),rm.get(id),path+'.'+id);if(value!==undefined)out.push(value);}
      return out;
    }
    throw new Error('conflict:'+path);
  }
  return validateState(merge(base,local,remote,''));
}

export function cloudClient(fetcher = fetch, endpoint = CLOUD_ENDPOINT) {
  const parse = raw => {
    if (!Number.isSafeInteger(raw.version) || raw.version < 0) throw new Error('云端版本无效');
    const document=validateState(raw.document);
    if(document.revision!==raw.version)throw new Error('云端版本不一致');
    return {...raw,document};
  };
  async function read(version) {
    const response=await fetcher(endpoint,{cache:'no-store',headers:version==null?{}:{'If-None-Match':'"'+version+'"'},signal:AbortSignal.timeout(15000)});
    if(response.status===304)return null;
    if(!response.ok)throw new Error('暂时无法连接服务器');
    return parse(await response.json());
  }
  async function write(document,expectedVersion,mutationId) {
    const options={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({document,expectedVersion,mutationId})};
    let response;
    for(let attempt=0;attempt<2;attempt++) {
      try{response=await fetcher(endpoint,{...options,signal:AbortSignal.timeout(15000)});break;}catch(error){if(attempt)throw error;}
    }
    if(response.status!==409&&!response.ok)throw new Error('服务器未确认保存，请稍后重试');
    return {conflict:response.status===409,snapshot:parse(await response.json())};
  }
  async function save(base,next,version) {
    let currentBase=base,currentNext=next,currentVersion=version;
    for(let attempt=0;attempt<3;attempt++) {
      const result=await write(currentNext,currentVersion,crypto.randomUUID());
      if(!result.conflict)return result.snapshot;
      try { currentNext=mergeCloudDocuments(currentBase,currentNext,result.snapshot.document); }
      catch { const error=new Error('其他设备修改了同一内容，本次未保存。草稿已备份，请刷新同步后重新编辑。');error.snapshot=result.snapshot;throw error; }
      currentBase=result.snapshot.document;currentVersion=result.snapshot.version;
    }
    throw new Error('其他设备正在频繁编辑，本次未保存，请稍后重试');
  }
  return {read,save};
}
