// Hotel nights come from the user's DOCX; first night explicitly corrected by
// the user to Grand Hotel Serapide on 2026-10-21. Only public hotel facts here.
export const hotels = [
  {day:2,name:'Grand Hotel Serapide',city:'波佐利',address:'Via S. Gennaro Agnano, 34, Pozzuoli',point:[40.822909,14.142697],url:'https://www.grandhotelserapide.it/contatti/',location:'官网 GPS',note:'用户确认以文档截图与地址为准，原文字中的 Towers Hotel 不采用。位于那不勒斯以西的波佐利，不能按那不勒斯市中心安排夜游。'},
  {day:3,name:'San Severino Park Hotel & Spa',city:'梅尔卡托圣塞韦里诺',address:'Via Bagnara, 10, Mercato San Severino',point:[40.772151,14.744192],url:'https://sanseverinoparkhotel.com/contatti/',location:'官网嵌入地图参考位置，非精确门口',note:'萨勒诺内陆住宿，不在海边市中心。文档与官网邮编不同，导航以酒店名、街道及城市为准。'},
  {day:4,name:'Hotel Principe',city:'波梅齐亚',address:'Via dei Castelli Romani, 14A, Pomezia',point:[41.679114,12.501461],url:'https://www.hotelprincipegroup.it/contatti',location:'官网嵌入地图街道参考位置，非精确门口',note:'罗马以南的波梅齐亚住宿，不是罗马市中心；不据此安排步行返回罗马景点。文档邮编 00040、官网 00071，保留街道与城市用于核对。'},
  {day:5,name:'Hotel Carpi',city:'卡尔皮',address:'Via delle Magliaie, 2/4, 41012 Carpi',point:[44.777162,10.861098],url:'https://www.hotelcarpi.it/en/contacts',location:'官网 GPS',note:'原行程未命名的“意大利小镇”住宿落实为卡尔皮；不是新增团队游览项目。'},
  {day:6,name:'AS Hotel Limbiate Fiera',city:'林比亚泰',address:'Corso Como, 52, 20812 Limbiate',point:[45.605722,9.139944],url:'https://www.ashotels.it/as-hotel-limbiate-fiera',coordinateUrl:'https://www.ashotels.it/pdf/hotel/limbiate_es.pdf',location:'酒店官方手册 GPS：45°36′20.6″N 9°08′23.8″E',note:'位于米兰北侧林比亚泰；米兰教堂后的自由活动从市区集合点出发，不以酒店作步行起点。'},
  {day:7,name:'Grand Hotel Villa Cappugi',city:'皮斯托亚',address:'Via di Collegigliato, 45, 51100 Pistoia',point:[43.949950,10.920279],url:'https://www.hotelvillacappugi.com/en/four-stars-hotel-pistoia/',location:'官网十进制 GPS',note:'文档分组写“蒙特卡蒂尼”，酒店与地址实际在皮斯托亚；当晚住宿和次晨出发按皮斯托亚标注。'},
  {day:8,name:"Grand Hotel Duca d'Este",city:'蒂沃利温泉区',address:'Via Nazionale Tiburtina, 330, 00019 Tivoli Terme',point:[41.952948,12.716396],url:'https://www.ducadeste.com/en/contatti/',location:'官网 GPS；官网建议导航入口 Via Emilio Salgari',note:'在罗马以东的 Tivoli Terme，不在罗马市中心或蒂沃利山城。次日从此去 FCO；先核实离店、集合与机场到达时间，不安排返程晨游。'}
];
const section=(title,body,links=[])=>({title,body,steps:[],phrases:[],images:[],links});
const event=(id,name,h,note)=>({id,name,point:h.point,time:'按领队通知',duration:'',transport:'团队交通',status:'confirmed',note,url:h.url,photo:null,photos:[]});
const stop=h=>({name:h.city+' · '+h.name,point:h.point});
const link=(label,url)=>({label,url});

export function addHotels(state) {
  for(const h of hotels) {
    const d=state.days[h.day-1],next=state.days[h.day],hotelEventId=d.id+'-hotel';
    d.lodging=h.name+' · '+h.city+'｜'+h.address;
    d.lodgingStatus='confirmed';
    d.stops[d.stops.length-1]=stop(h);
    next.stops[0]=stop(h);
    d.activities.push(event(hotelEventId,'入住 · '+h.name,h,'10.'+(20+h.day)+' 入住 / 次日退房。住宿已确认；抵达、晚餐地点与时刻仍按领队通知。\n'+h.address+'\n'+h.note+'\n定位依据：'+h.location+'；2026-10-21 核验。'));
    // The first activity on the following day already represents departure.
    const start=next.activities[0];
    start.name='从 '+h.city+' 酒店出发';start.point=h.point;start.url=h.url;
    start.note='出发酒店：'+h.name+'；'+h.address+'。\n'+(h.day===8?'原单 08:00 早餐出发，与 12:00 国际航班提前 4 小时到机场的说明存在冲突；需领队确认实际离店时间，不安排晨游。':'原单时刻仅作参考，早餐和发车以领队通知为准。');
    // Keep the team meal separate from the now-located hotel arrival.
    const last=d.activities.filter(a=>!a.id.startsWith('italy-option-')&&a.id!==hotelEventId).at(-1);
    if(h.day!==6){last.name=h.day===3?'晚餐自理 · 时间待通知':'团队晚餐 · 地点待通知';last.note='餐厅和抵达酒店的时间待领队通知；酒店已另列为入住安排。';}
    else last.note='原单 15:30 前往米兰方向；实际入住林比亚泰 AS Hotel Limbiate Fiera，是否先在米兰市区停留、晚餐位置与抵达时间待领队确认。';
    d.source+=' 酒店更新：用户提供《意大利一团酒店.docx》，2026-10-21 核对；10.22 酒店名由用户确认。';
  }
  // D7 must visit Milan between the suburban hotel and Pistoia; hotel towns
  // replace overnight endpoints, not the team's daytime sightseeing stops.
  state.days[6].stops.splice(1,0,{name:'米兰大教堂',point:state.days[6].activities.find(a=>a.id==='italy-d7-a2').point});
  const summaries={
    2:'罗马机场 → 罗马团队游览 → 波佐利 Grand Hotel Serapide。当天转场很长，晚间活动以实际抵达为准。',
    3:'波佐利酒店 → 波西塔诺 → 阿马尔菲 → 梅尔卡托圣塞韦里诺酒店。海岸车船衔接与停靠点仍待确认。',
    4:'梅尔卡托圣塞韦里诺酒店 → 庞贝 → 波梅齐亚 Hotel Principe。原单写罗马方向，不自动增加罗马市内游览。',
    5:'波梅齐亚酒店 → 白露里治奥 → 卡尔皮 Hotel Carpi。原单 14:00 古镇、18:00 晚餐的时间需结合实际长途转场复核。',
    6:'卡尔皮酒店 → 威尼斯 → 林比亚泰 AS Hotel Limbiate Fiera。威尼斯上下船码头与集合位置仍待领队通知。',
    7:'林比亚泰酒店 → 米兰大教堂及自由活动 → 皮斯托亚 Grand Hotel Villa Cappugi。自由活动结束后随团长途转场。',
    8:"皮斯托亚酒店 → 比萨 → 佛罗伦萨 → 蒂沃利温泉区 Grand Hotel Duca d'Este。晚间抵达时间待定。",
    9:'蒂沃利温泉区酒店 → 罗马 FCO 机场 → 成都。12:00 航班为原单参考；离店和机场到达时间请领队重新核定。'
  };
  for(let n=2;n<=9;n++){
    const d=state.days[n-1],primary=d.routePlans[0];
    d.note='酒店更新后的路线：'+summaries[n]+'\n'+(n===7?'自己的时间：米兰教堂后明确有自由活动，开始、结束和集合点待通知。':'自己的时间：只有领队确认可离团后再执行备选；酒店确定不代表新增自由活动。');
    primary.note='入住地点已按酒店表补全；地点间连线只示意先后，非道路导航。团队游览、用餐和发车时刻仍以领队通知为准。';
    primary.stops=d.stops.map((s,j)=>({id:d.id+'-s'+j,...s,eventIds:d.activities.filter(a=>a.point&&JSON.stringify(a.point)===JSON.stringify(s.point)).map(a=>a.id),note:s.name.includes(' · ')?'酒店位置参考；上车点与集合时间由领队指定。':'景区 / 城市参考点，非确认集合点。',url:''}));
    for(const a of d.activities.filter(a=>a.point&&a.status!=='optional'))if(!primary.stops.some(s=>s.eventIds.includes(a.id)))primary.stops.push({id:a.id+'-point',name:a.name,point:a.point,eventIds:[a.id],note:a.note,url:a.url});
    primary.legs=d.stops.slice(1).flatMap((s,j)=>s.point&&d.stops[j].point?[{id:d.id+'-leg'+(j+1),from:d.id+'-s'+j,to:d.id+'-s'+(j+1),mode:'团队交通 · 示意',duration:'以领队安排为准',note:'按酒店位置调整的先后示意线，不是实际道路或耗时，不用于导航。',url:'',checkedDate:'2026-10-21'}]:[]);
    d.road=null;
  }
  state.packing.find(p=>p.id==='italy-check-5').name='核对已确认的 7 晚酒店、每日酒店集合点与次晨发车时间。';
  const before=state.guides.find(g=>g.id==='italy-guide-before');
  before.sections[1].body=before.sections[1].body.replace('那不勒斯没有明确市区自由活动，酒店也未知。','那不勒斯没有明确市区自由活动，10.22 实际住波佐利；不把酒店当市中心出发点。');
  const source=state.guides.find(g=>g.id==='italy-guide-sources');
  source.summary='团队行程来自用户 PDF，7 晚酒店来自补充 DOCX；图片为景观参考，集合时间待最终通知。';
  source.body+=' 酒店名称与入住夜来自用户补充文档；10.22 以用户明确回复的 Grand Hotel Serapide 为准。酒店定位为官网 GPS 或官网嵌入地图参考点，不等于团队停车入口。';
  source.checkedDate='2026-10-21';
  state.guides.unshift({id:'italy-guide-hotels-20261021',title:'7 晚酒店与出发路线',category:'住宿信息',summary:'10.22—10.28 酒店已确认；卡尔皮、林比亚泰、皮斯托亚和罗马周边落脚点已补入地图。',body:'按入住夜对应 D2—D8，次日从上一晚酒店出发。团队景点未改为自由行；酒店位置不会自动确认用餐地点、发车或离团时段。名称、街道和城市供核对，导航请同时搜索酒店名。',url:'',checkedDate:'2026-10-21',sections:[...hotels.map(h=>section('10.'+(20+h.day)+' · '+h.city+' · '+h.name,h.address+'\n'+h.note+'\n定位：'+h.location+'。地图标记不是约定集合点。',[link('酒店官网',h.url),...(h.coordinateUrl?[link('官方定位手册',h.coordinateUrl)]:[])])),section('入住后的人文散步候选','10.25 卡尔皮：若抵达后领队允许且返程交通已落实，可考虑 Piazza dei Martiri 与 Palazzo dei Pio 外观，感受城堡、宫殿和广场的关系。酒店不在历史中心，不默认步行可达。\n10.27 皮斯托亚：若长途转场后仍有余力，可考虑 Piazza del Duomo 的中世纪广场与建筑外观。须先核实酒店往返路线与返回时间；不承诺晚间场馆开放。\n这两项只是酒店确定后可询问领队的候选，未加入团队必经路线。',[link('卡尔皮官方旅游：Palazzo dei Pio','https://www.visitcarpi.it/palazzo-dei-pio'),link('托斯卡纳官方旅游：皮斯托亚大教堂广场','https://www.visittuscany.com/en/attractions/piazza-duomo-in-pistoia/')] ),section('返程早晨','10.29 从蒂沃利温泉区前往 FCO，不能用罗马市中心出发时间代替。原单 08:00 早餐出发与 12:00 国际航班提前 4 小时到场要求冲突；请领队明确发车时间。这里不编造实时车程，不安排出发前支线。')]});
  return state;
}
