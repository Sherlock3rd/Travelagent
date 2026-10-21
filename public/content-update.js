import { blankState, validateState } from './model.js';
import { mergeCloudDocuments } from './cloud-sync.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const wrapper=day=>({...blankState(),days:[day]});

// One versioned, local-only source update. A deleted trip/day remains deleted;
// existing user edits win conflicts, while an accompanying hotel guide keeps
// the new source facts available. Route geometry and its event links are atomic.
export function mergeContentUpdate(current, update) {
  const next=structuredClone(current),conflicts=[];
  for(const old of update.before.days) {
    const index=next.days.findIndex(d=>d.id===old.id),fresh=update.after.days.find(d=>d.id===old.id);
    if(index<0||!fresh||same(old,fresh))continue;
    let day=next.days[index];
    for(const fields of [['lodging','lodgingStatus'],['stops','road','activities','routePlans'],['note'],['source']]) {
      const remote=structuredClone(old);
      for(const k of fields)remote[k]=fresh[k];
      try {day=mergeCloudDocuments(wrapper(old),wrapper(day),wrapper(remote)).days[0];}
      catch {conflicts.push(old.id+' / '+fields[0]);}
    }
    next.days[index]=day;
  }
  if(next.days.some(d=>update.before.days.some(b=>b.id===d.id))) {
    for(const key of ['packing','guides']) {
      const b={...blankState(),[key]:update.before[key]},l={...blankState(),[key]:next[key]},r={...blankState(),[key]:update.after[key]};
      // Merge records separately so one custom guide does not block all hotels.
      for(const fresh of r[key]) {
        const old=b[key].find(row=>row.id===fresh.id),i=l[key].findIndex(row=>row.id===fresh.id);
        if(!old){if(i<0)l[key].push(fresh);continue;}
        if(i<0||same(old,fresh))continue;
        try {l[key][i]=mergeCloudDocuments({...blankState(),[key]:[old]},{...blankState(),[key]:[l[key][i]]},{...blankState(),[key]:[fresh]})[key][0];}
        catch {conflicts.push(fresh.id);}
      }
      next[key]=l[key];
    }
  }
  const changed=!same(current,next);
  if(changed)next.revision=current.revision+1;
  return {state:validateState(next),changed,conflicts};
}

export function applyContentUpdate(storage,key,update) {
  const marker=key+'.update.'+update.id,raw=storage.getItem(key);
  if(raw===null)return null;
  if(storage.getItem(marker)!==null)return {state:validateState(JSON.parse(raw)),serialized:raw,changed:false,conflicts:[]};
  const result=mergeContentUpdate(validateState(JSON.parse(raw)),update);
  const serialized=JSON.stringify(result.state);
  if(result.changed){
    const backup=marker+'.backup';
    if(storage.getItem(backup)===null)storage.setItem(backup,raw);
    // Check again after backup; a newer tab must never be overwritten.
    if(storage.getItem(key)!==raw)throw Error('另一页面更新了行程，请刷新后重试酒店更新。');
    storage.setItem(key,serialized);
  }
  storage.setItem(marker,JSON.stringify({conflicts:result.conflicts}));
  return {...result,serialized};
}
