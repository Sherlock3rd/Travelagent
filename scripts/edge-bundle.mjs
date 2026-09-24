import { readFile, mkdir, writeFile } from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const files=[{name:'index.ts',content:await readFile(new URL('supabase/functions/travel-sync/index.ts',root),'utf8')}];
for(const name of ['model.js','day-media.js','guides.js','countries.js','journeys.js','map.js','lightbox.js']) files.push({name,content:await readFile(new URL('public/'+name,root),'utf8')});
await mkdir(new URL('.runtime/',root),{recursive:true});
await writeFile(new URL('.runtime/edge-bundle.json',root),JSON.stringify(files));
console.log('Edge bundle ready: .runtime/edge-bundle.json');
