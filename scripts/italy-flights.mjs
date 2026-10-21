// Flight times and endpoints are references from the supplied itinerary, not
// live flight status. Keep assembly day and actual departure date distinct.
export function addItalyFlights(state) {
  const outbound=state.days.find(d=>d.id==='italy-d1');
  const arrival=state.days.find(d=>d.id==='italy-d2').stops[0];
  const tfu=outbound.stops[0];
  const outboundNote='D1（10.21）在成都集合；3U3895 实际参考起飞为 D2（10.22）01:40，07:00 抵达罗马，两端均为当地时间。此跨日衔接线仅示意两机场位置，不是实际飞行轨迹；航班以出票为准。';
  outbound.stops[1]={name:arrival.name+'（10.22 抵达）',point:arrival.point};
  const plan=outbound.routePlans[0];
  plan.name='跨日航班 · 成都 → 罗马';plan.note=outboundNote;
  Object.assign(plan.stops[1],outbound.stops[1],{note:outboundNote});
  plan.legs=[{id:'italy-flight-3u3895',from:plan.stops[0].id,to:plan.stops[1].id,mode:'飞机 · 3U3895 · 跨日衔接',duration:'10.22 01:40 → 07:00（当地时间，参考）',note:outboundNote,url:'',checkedDate:'',road:null}];
  outbound.note+='\n地图衔接：'+outboundNote;
  const inbound=state.days.find(d=>d.id==='italy-d9'),back=inbound.routePlans[0];
  const inboundNote='3U3896：10.29 12:00 罗马起飞，10.30 05:30 成都到达（当地时间，原单参考）。飞机连线不是实际航迹；酒店至机场仍按领队安排。';
  const stop={name:tfu.name+'（10.30 抵达）',point:tfu.point};
  inbound.stops.push(stop);
  back.stops.push({id:'italy-d9-arrival-tfu',...stop,eventIds:['italy-d9-a2'],note:inboundNote,url:''});
  back.legs.push({id:'italy-flight-3u3896',from:'italy-d9-s1',to:'italy-d9-arrival-tfu',mode:'飞机 · 3U3896',duration:'10.29 12:00 → 10.30 05:30（当地时间，参考）',note:inboundNote,url:'',checkedDate:'',road:null});
  inbound.note+='\n返程衔接：'+inboundNote;
  return state;
}
