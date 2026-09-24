import { createMap, addBasemap } from './map.js';
const previewSelection = new Map();
export const PHOTO_HOSTS = ['egymonuments.gov.eg', '1442038683.rsc.cdn77.org', 'dohahamadairport.com'];
export function parsePhoto(raw, { safeURL, validDate }) {
  if (raw == null) return null;
  const text = (s,max) => { if (typeof s !== 'string' || s.length > max) throw Error('景观图片文字无效。'); return s.trim(); };
  const url = safeURL(text(raw.url,2500)), parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.port || !PHOTO_HOSTS.includes(parsed.hostname)) throw Error('景观图片须使用支持的官方 HTTPS 来源。');
  return { url, title:text(raw.title,160), caption:text(raw.caption,600), sourceUrl:safeURL(text(raw.sourceUrl,2500)), credit:text(raw.credit,200), checkedDate:validDate(raw.checkedDate) };
}
export function previewGeometry(day, planId) {
  const plan = day.routePlans.find(p => p.id === planId) || day.routePlans[0];
  if (plan) return { name:plan.name, planId:plan.id, stops:plan.stops, paths:plan.legs.flatMap(l => {
    const a=plan.stops.find(s=>s.id===l.from), b=plan.stops.find(s=>s.id===l.to);
    return a.point && b.point ? [{points:l.road?.points || [a.point,b.point],road:Boolean(l.road),label:a.name+' → '+b.name+' · '+l.mode+' · '+l.duration}] : [];
  }) };
  const stops = day.activities.some(a=>a.point) ? day.activities.map(a=>({...a,eventIds:[a.id]})) : day.stops.map((s,i)=>({...s,id:'stop-'+i,eventIds:[]}));
  const paths=[];
  for(let i=1;i<stops.length;i++) if(stops[i-1].point && stops[i].point && stops[i-1].status!=='optional' && stops[i].status!=='optional') paths.push({points:[stops[i-1].point,stops[i].point],road:false,label:'顺序示意'});
  if (!day.activities.some(a=>a.point) && day.road) return {name:'当日公路',planId:'',stops,paths:[{points:day.road.points,road:true,label:'已保存的公路估算'}]};
  return {name:'当日站点',planId:'',stops,paths};
}
export function dayMediaHTML(day, esc) {
  const seen=new Set();
  const photos=day.activities.filter(a=>{if(!a.photo || seen.has(a.photo.url)) return false; seen.add(a.photo.url);return true;});
  return '<section class="day-media" data-media-day="'+day.id+'" aria-label="当天路线与景观"><div class="day-map-panel"><div class="day-media-heading"><h3>当日路线小地图</h3><button class="text-button" data-mini-open="'+day.id+'">打开大地图 ↗</button></div>'+
    (day.routePlans.length?'<label class="mini-plan-label">路线方案<select data-mini-plan="'+day.id+'">'+day.routePlans.map(p=>'<option value="'+p.id+'"'+(p.id===previewSelection.get(day.id)?' selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></label>':'')+
    '<div class="mini-map-wrap"><div class="daily-mini-map" id="mini-'+day.id+'" aria-label="当日局部路线地图"><span class="mini-placeholder">滚动到此处加载地图</span></div></div><div class="mini-tools"><button class="text-button" data-mini-fit="'+day.id+'">适应路线</button><button class="text-button" data-mini-pois="'+day.id+'">聚焦景点</button><span>＋ / − 缩放 · 双指缩放</span></div><p class="mini-caption">实线：道路估算；虚线：站点 / 航段示意。方案切换只作预览，未知位置不连线。</p><div class="mini-stop-list" id="mini-stops-'+day.id+'"></div></div><div class="day-photo-panel"><h3>沿途景观 · 参考照片</h3>'+ (photos.length?'<div class="day-photo-grid">'+photos.map(a=>'<figure><a class="scenery-image" href="'+esc(a.photo.url)+'" target="_blank" rel="noopener noreferrer"><img src="'+esc(a.photo.url)+'" alt="'+esc(a.photo.title)+'" loading="lazy" referrerpolicy="no-referrer"><span>查看大图 ↗</span></a><figcaption><button class="text-button" data-go-event="'+a.id+'" data-day="'+day.id+'">'+esc(a.photo.title)+' ↗</button><span class="photo-status">'+(a.status==='optional'?'备选 · 未选定':a.status==='confirmed'?'关联安排已确认':'计划 · 待确认')+'</span><p>'+esc(a.photo.caption)+'</p><a href="'+esc(a.photo.sourceUrl)+'" target="_blank" rel="noopener noreferrer">图片来源 · '+esc(a.photo.credit)+'</a><span class="photo-fallback" hidden>图片暂未加载，可打开来源查看。</span></figcaption></figure>').join('')+'</div>':'<p class="form-hint">这一天暂无已核实的景观照片。交通日保留路线图；待定地点不配无关图片。</p>')+'</div></section>';
}
// Only near-screen maps allocate a WebGL basemap. Leaving the viewport frees it.
export function mountDayMedia(root, days, esc, onEvent, onOpen) {
  const active=new Map(), selected=previewSelection;
  const dayById=new Map(days.map(d=>[d.id,d]));
  function geometry(id) {return previewGeometry(dayById.get(id),selected.get(id));}
  function fit(id,pois=false) {
    const entry=active.get(id); if(!entry)return;
    const g=geometry(id),day=dayById.get(id);
    const photoPoints=day.activities.filter(a=>a.photo && (!g.planId || g.stops.some(s=>s.eventIds?.includes(a.id)))).map(a=>a.point || g.stops.find(s=>s.eventIds?.includes(a.id))?.point).filter(Boolean);
    const points=pois && photoPoints.length ? photoPoints : [...g.stops.map(s=>s.point).filter(Boolean),...g.paths.flatMap(p=>p.points)];
    if(points.length)entry.map.fitBounds(points,{padding:[35,35],maxZoom:pois?15:14,animate:false});
  }
  function paint(id) {
    const entry=active.get(id),g=geometry(id);if(!entry)return;
    entry.layer.clearLayers();
    g.paths.forEach(p=>{
      L.polyline(p.points,{color:'#fff',weight:8,opacity:1,interactive:false}).addTo(entry.layer);
      L.polyline(p.points,{color:'#b44f2b',weight:4,opacity:1,dashArray:p.road?null:'8 6'}).bindTooltip(esc(p.label),{sticky:true}).addTo(entry.layer);
    });
    g.stops.forEach((s,i)=>{
      if(!s.point)return;
      const marker=L.marker(s.point,{title:s.name,icon:L.divIcon({className:'route-number',html:'<span style="--route-color:#285d46">'+(i+1)+'</span>',iconSize:[28,28],iconAnchor:[14,14]})}).addTo(entry.layer).bindTooltip(esc((i+1)+'. '+s.name));
      const box=document.createElement('div');box.className='mini-popup';box.textContent=s.name;
      for(const eventId of s.eventIds || []) {const b=document.createElement('button');b.type='button';b.className='text-button';b.textContent='查看对应安排 ↗';b.onclick=()=>onEvent(id,eventId);box.append(b);}
      marker.bindPopup(box);
    });
    const list=root.querySelector('#mini-stops-'+id);
    list.innerHTML=g.stops.map((s,i)=>'<span>'+ (i+1)+'. '+esc(s.name)+(s.point?'':'（位置待补）')+'</span>').join('');
    fit(id);
  }
  function create(id) {
    if(active.has(id))return;
    const el=root.querySelector('#mini-'+id);el.replaceChildren();
    const g=geometry(id);
    if(!g.stops.some(s=>s.point)) {el.textContent='当日位置待补充，暂不能绘制路线。';return;}
    try {
      const map=createMap(el).setView(g.stops.find(s=>s.point).point,10);map.scrollWheelZoom.disable();
      const layer=L.layerGroup().addTo(map);active.set(id,{map,layer});addBasemap(map);paint(id);
    } catch {el.textContent='小地图暂不可用，可点击“打开大地图”或查看文字路线。';}
  }
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(e=>{const id=e.target.dataset.mediaDay;if(e.isIntersecting)create(id);else if(active.has(id)){active.get(id).map.remove();active.delete(id);}});
  },{rootMargin:'100px'});
  root.querySelectorAll('[data-media-day]').forEach(el=>observer.observe(el));
  const change=e=>{if(e.target.matches('[data-mini-plan]')){const id=e.target.dataset.miniPlan;selected.set(id,e.target.value);paint(id);}};
  const click=e=>{const b=e.target.closest('[data-mini-fit],[data-mini-pois],[data-mini-open]');if(!b)return;if(b.dataset.miniOpen){const id=b.dataset.miniOpen;onOpen(id,geometry(id).planId);}else fit(b.dataset.miniFit||b.dataset.miniPois,Boolean(b.dataset.miniPois));};
  root.addEventListener('change',change);root.addEventListener('click',click);
  root.querySelectorAll('.scenery-image img').forEach(img=>img.onerror=()=>{img.hidden=true;img.closest('figure').querySelector('.photo-fallback').hidden=false;});
  return ()=>{observer.disconnect();for(const {map} of active.values())map.remove();root.removeEventListener('change',change);root.removeEventListener('click',click);};
}
