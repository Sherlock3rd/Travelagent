import { STORAGE_KEY as EGYPT_KEY, validateState } from './model.js';
import { RECOVERY_KEY as EGYPT_RECOVERY } from './cloud-sync.js';

// The shared UI must never send an Italy document to the Egypt workspace.
export const isItaly = typeof document !== 'undefined' && document.body.dataset.trip === 'italy';
export const STORAGE_KEY = isItaly ? 'travelagent.italy.workspace.v1' : EGYPT_KEY;
export const RECOVERY_KEY = isItaly ? 'travelagent.italy.recovery.v1' : EGYPT_RECOVERY;
export const publishedPath = isItaly ? './italy-trip.json' : './published-trip.json';
export const dateLabel = day => day.date || (isItaly && /^italy-d\d+$/.test(day.id) ? '10.' + (20 + Number(day.id.slice(7))) : '日期待定');

export function migrateItalyChecklist(state, saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return state;
  for (let i = 0; i < 9; i++) {
    const row=state.packing.find(p=>p.id==='italy-check-'+i);
    if(row && saved[i] === true) row.done=true;
  }
  return state;
}

export function localTripClient(storage, key) {
  const snapshot=()=>{const document=validateState(JSON.parse(storage.getItem(key)));return {version:document.revision,document};};
  return {
    async read(version){const current=snapshot();return current.version===version?null:current;},
    async save(base,next,version){
      const current=snapshot();
      if(current.version!==version || JSON.stringify(current.document)!==JSON.stringify(base)) {
        const error=new Error('另一页面已有更新，本次草稿已保留，请刷新后重新编辑。');error.snapshot=current;throw error;
      }
      const document=validateState(next);
      storage.setItem(key,JSON.stringify(document));
      return {version:document.revision,document};
    }
  };
}
