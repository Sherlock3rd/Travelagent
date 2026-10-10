// Reproducible Wikimedia Commons reference assets. No private itinerary input.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const credits=JSON.parse(await readFile('public/media/italy/credits.json','utf8'));
const pages=Object.values(credits).map(m=>({title:m.title,pageimage:decodeURIComponent(m.sourceUrl.split('File:')[1]),coordinates:m.point?[{lat:m.point[0],lon:m.point[1]}]:[]}));
await mkdir('.runtime',{recursive:true});
const keys={'Colosseum':'rome','Positano':'positano','Amalfi Cathedral':'amalfi','Pompeii':'pompeii','Civita di Bagnoregio':'civita','Piazza San Marco':'venice','Milan Cathedral':'milan','Florence Cathedral':'florence','Leaning Tower of Pisa':'pisa','Sforza Castle':'castle',"Doge's Palace":'ducal','Loggia dei Lanzi':'loggia',"Sant'Ignazio, Rome":'ignazio'};
const query=new URLSearchParams({action:'query',titles:pages.filter(p=>p.pageimage).map(p=>'File:'+p.pageimage).join('|'),prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'960',format:'json'});
execFileSync('curl.exe',['-f','-L','--retry','2','--max-time','50','-sS','https://commons.wikimedia.org/w/api.php?'+query,'-o','.runtime/italy-commons.json']);
const files=Object.values(JSON.parse(await readFile('.runtime/italy-commons.json','utf8')).query.pages);
await mkdir('public/media/italy',{recursive:true});
const clean=s=>s.replace(/<[^>]*>/g,'').replace(/&#0*39;/g,"'").replace(/&amp;/g,'&').trim();
const result={};
for(const p of pages) {
  if(!keys[p.title]||!p.pageimage)continue;
  const file=files.find(f=>f.title.replaceAll(' ','_')==='File:'+p.pageimage.replaceAll(' ','_'));
  const info=file.imageinfo[0],meta=info.extmetadata,license=meta.LicenseShortName?.value;
  if(!license || !/CC|Public domain/i.test(license))throw Error('Check license: '+p.title+' '+license);
  const key=keys[p.title],path='media/italy/'+key+'.jpg';
  execFileSync('curl.exe',['-f','-L','--retry','2','--max-time','45','-sS',info.thumburl,'-o','public/'+path]);
  const bytes=await readFile('public/'+path);if(bytes[0]!==255||bytes[1]!==216)throw Error('Not JPEG: '+key);
  result[key]={path,sourceUrl:info.descriptionurl,original:info.url,credit:clean(meta.Artist?.value||'Wikimedia Commons').slice(0,150),license,licenseUrl:meta.LicenseUrl?.value||'',point:p.coordinates?.[0]?[p.coordinates[0].lat,p.coordinates[0].lon]:null,title:p.title};
  console.log(key,bytes.length,license);
}
await writeFile('public/media/italy/credits.json',JSON.stringify(result,null,2)+'\n');
console.log('Saved',Object.keys(result).length,'reference photos');
