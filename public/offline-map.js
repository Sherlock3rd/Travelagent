// A small public-domain geographic base stays underneath the online street map.
// Route/POI layers still use their actual coordinates, with no invented roads.
let geography;
export function addOfflineMap(map) {
  const pane=map.createPane('offline-geography');pane.style.zIndex='190';pane.style.pointerEvents='none';
  map.getContainer().classList.add('has-offline-geography');
  let disposed=false;
  map.once('unload',()=>{disposed=true;});
  geography ||= fetch(new URL('./italy-geography.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('base unavailable');return r.json();}).catch(error=>{geography=null;throw error;});
  geography.then(data=>{
    if(disposed)return;
    L.geoJSON(data,{pane:'offline-geography',interactive:false,style:f=>({color:'#a9b6a8',weight:1,fillColor:f.properties.name==='Italy'?'#eee9d9':'#f6f2e8',fillOpacity:1})}).addTo(map);
    map.attributionControl.addAttribution('<a href="https://www.naturalearthdata.com/about/terms-of-use/">Natural Earth</a> · 离线地理轮廓（非街道导航）');
  }).catch(()=>{});
}
