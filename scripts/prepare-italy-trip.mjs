import { readFile, writeFile } from 'node:fs/promises';
import { days, options, sources } from '../public/italy-data.js';
import { blankState, validateState } from '../public/model.js';
const media=JSON.parse(await readFile('public/media/italy/credits.json','utf8'));
const coordPages=JSON.parse(await readFile('public/italy-place-sources.json','utf8'));
const coord=title=>coordPages[title]?.point||null;
const ref=title=>'https://en.wikipedia.org/wiki/'+encodeURIComponent(title.replaceAll(' ','_'));
const pts={};
for(const [key,m] of Object.entries(media))pts[key]=m.point;
Object.assign(pts,{romeCity:[41.9028,12.4964],dante:[43.77109,11.25705],montecatini:[43.88277778,10.77111111],sighs:[45.43405556,12.34086111],naples:coord('Naples'),salerno:coord('Salerno'),arch:coord('Arch of Constantine'),pantheon:coord('Pantheon, Rome'),trevi:coord('Trevi Fountain'),spanish:coord('Spanish Steps'),rialto:coord('Rialto Bridge'),ambrosiana:coord('Biblioteca Ambrosiana'),fco:coord('Rome Fiumicino Airport'),tfu:coord('Chengdu Tianfu International Airport'),giotto:coord("Giotto's Campanile"),croce:coord('Santa Croce, Florence')});
const names={romeCity:'罗马（城市参考点）',naples:'那不勒斯（城市参考点）',salerno:'萨勒诺（城市参考点）',rome:'斗兽场',positano:'波西塔诺',amalfi:'阿马尔菲主教堂广场',pompeii:'庞贝考古遗址',civita:'白露里治奥',venice:'圣马可广场',milan:'米兰大教堂',florence:'佛罗伦萨大教堂',pisa:'比萨斜塔',castle:'斯福尔扎城堡',ducal:'总督府',loggia:'佣兵凉廊',ignazio:'圣依纳爵堂',ambrosiana:'安布罗修美术馆',arch:'君士坦丁凯旋门',pantheon:'万神殿',trevi:'许愿池',spanish:'西班牙广场',rialto:'里亚托桥',fco:'罗马菲乌米奇诺机场',tfu:'成都天府机场',giotto:'乔托钟楼',croce:'圣十字广场附近'};
Object.assign(names,{dante:'但丁故居',montecatini:'蒙特卡蒂尼（城市参考点）',sighs:'叹息桥'});
const photo=(key,title)=>{const m=media[key];return m?{url:m.path,title:(key==='ignazio'?'圣依纳爵堂 · 外观':key==='castle'?'斯福尔扎城堡 · 外观':title||names[key]),caption:'景观参考照片，非本次实拍；不代表已预约或自由活动获准。原作者许可：'+m.license+'；'+m.licenseUrl+'。保留 Commons 提供的缩略图，未另作修改。',credit:m.credit+' · '+m.license,sourceUrl:m.sourceUrl,checkedDate:'2026-10-10'}:null;};
const state=blankState();
state.trip={title:'意大利 · 十日之间',destination:'10.21—10.30 · 跟团游 · 年份待确认',countryCode:'ITA',startDate:'',endDate:''};
// Time slots and minimum visits come from PDF pp. 1–4. Unknown hotels/meeting points stay unlocated.
const events=[
  [['指定时间','天府机场 T1 集合','tfu','','航班在次日凌晨；集合时间以领队通知为准。']],
  [['01:40 → 07:00','成都 → 罗马 · 3U3895','fco','约 12 小时','参考航班 TFU T1 → FCO T3；实际以出票为准。'],['10:00','斗兽场（入内）','rome','不少于 60 分钟','团队安排。'],['随后','君士坦丁凯旋门','arch','不少于 10 分钟','团队安排。'],['12:00','团队午餐',null,'','餐厅待定。'],['14:00 起','许愿池','trevi','深度游合计不少于 120 分钟','与万神殿、西班牙广场合为罗马深度游，并非独立自由活动。'],['深度游期间','万神殿（外观）','pantheon','','不含入内承诺。'],['深度游期间','西班牙广场','spanish','','按导游实际步行顺序。'],['18:00','团队晚餐与入住',null,'','那不勒斯转场时刻及酒店地址待定。']],
  [['08:30','酒店早餐后出发',null,'','随团赴波西塔诺。'],['10:00','波西塔诺','positano','不少于 30 分钟','团队短停，非完整自由活动窗口。'],['自理','午餐',null,'','自理餐不等于可以离团。'],['14:00','阿马尔菲海岸','amalfi','不少于 30 分钟','地图以阿马尔菲镇中心为区域参考；具体停靠点、船班待确认。'],['18:00','萨勒诺方向入住',null,'','晚餐自理，四星酒店名称与位置待定。']],
  [['08:30','酒店早餐后出发',null,'','萨勒诺前往庞贝。'],['10:00','庞贝考古遗址（含人工讲解）','pompeii','不少于 1 小时','跟团深看：街道、民居、商铺与剧场的空间关系。参观出入口及开放街区以当天为准。'],['自理','午餐',null,'','午餐后赴罗马，转场时刻待定。'],['18:00','团队晚餐与入住',null,'','罗马方向，酒店待定。']],
  [['08:00','酒店早餐后出发',null,'','前往白露里治奥。'],['14:00','白露里治奥古镇','civita','不少于 30 分钟','先问是否含长桥往返。观察城门、石巷与山顶聚落；不把动画灵感宣传说法当作史实。'],['18:00','团队晚餐与入住',null,'','“意小镇”未给名称，地图不虚构其位置；午餐自理。']],
  [['08:00','酒店早餐后前往威尼斯',null,'','出发小镇、乘船码头未知。'],['10:30','贡多拉游船',null,'不少于 25 分钟','登船点未知，不把圣马可广场当作码头。'],['随后','叹息桥（外观）','sighs','不少于 15 分钟','随团安排，实际观景点待领队通知。'],['随后','圣马可广场','venice','不少于 20 分钟','水城公共空间与建筑观察；照片为夜景参考，行程为白天。'],['12:00','团队午餐',null,'','12:00—15:30 不自动视为自由时间。'],['15:30','前往米兰',null,'','确认这是船班还是大巴发车时间；团队晚餐后入住。']],
  [['08:00','酒店早餐后游米兰',null,'','酒店未知。'],['10:00','米兰大教堂（入内 + 登顶）','milan','不少于 60 分钟','实际入场以团队票为准。'],['12:00','团队午餐',null,'','餐厅与自由活动起止关系待确认。'],['教堂参观后','自由活动 · 指定时间集合','milan','结束时间待通知','原行程唯一明确的自由活动。地图以教堂广场作起点参考，真实集合点另核实。城堡与美术馆二选一。'],['18:00','晚餐后入住',null,'','随后蒙特卡蒂尼方向转场；酒店名称、具体时间待定。']],
  [['08:00','酒店早餐后出发',null,'','蒙特卡蒂尼出发，酒店未知。'],['10:00','比萨斜塔（外观，不上塔）','pisa','不少于 45 分钟','跟团参观。'],['12:00','团队午餐',null,'','餐厅待定。'],['14:00','前往佛罗伦萨',null,'','14:00 是出发安排，不是确认抵达。'],['抵达后','佛罗伦萨大教堂（外观）','florence','不少于 20 分钟','不安排登穹顶。'],['随后','乔托钟楼（外观）','giotto','不少于 5 分钟','与大教堂相邻。'],['随后','但丁故居（外观）','dante','不少于 10 分钟','仅外观，具体停留点与步行路线以领队为准。'],['随后','圣十字广场','croce','不少于 10 分钟','地图点为教堂附近参考，不代表集合点。'],['18:00','团队晚餐',null,'','后续赴罗马，实际转场与酒店待确认。']],
  [['08:00','早餐后前往机场',null,'','与行程说明“国际航班提前 4 小时到场”存在待澄清点，需核实离店时间。'],['12:00','罗马 → 成都 · 3U3896','fco','次日 05:30 抵达','参考 FCO T3 → TFU T1；实际航班以票面为准。不安排晨游。']],
  [['05:30','抵达成都，散团','tfu','','参考到达时间；保留后续回家交通与休息时间。']]
];
const cities=[['tfu',null],['fco','romeCity','naples'],['naples','positano','amalfi','salerno'],['salerno','pompeii','romeCity'],['romeCity','civita',null],[null,'venice','milan'],['milan','montecatini'],['montecatini','pisa','florence','romeCity'],['romeCity','fco'],['tfu',null]];
const unknown=['夜宿飞机','','','','意大利小镇（名称待定）','意大利小镇（名称待定）','蒙特卡蒂尼（酒店待定）','蒙特卡蒂尼（酒店待定）','','行程结束'];
state.days=days.map((d,i)=>{
  const id='italy-d'+d.id;
  const activities=events[i].map(([time,name,key,duration,note],j)=>({id:id+'-a'+(j+1),name,point:pts[key]||null,time,duration,transport:'按团队安排',status:'pending',note,url:media[key]?.sourceUrl||'',photo:photo(key),photos:[]}));
  const cityLabels={romeCity:'罗马',naples:'那不勒斯',salerno:'萨勒诺',venice:'威尼斯',milan:'米兰',florence:'佛罗伦萨',amalfi:'阿马尔菲',pisa:'比萨',montecatini:'蒙特卡蒂尼'};
  const stops=cities[i].map(key=>({name:key?(cityLabels[key]||names[key]):unknown[i],point:pts[key]||null}));
  const planStops=stops.map((s,j)=>({id:id+'-s'+j,...s,name:cities[i][j]?names[cities[i][j]]:s.name,eventIds:activities.filter(a=>a.point&&JSON.stringify(a.point)===JSON.stringify(s.point)).map(a=>a.id),note:'城市 / 景区参考点，不代表酒店、停车点或集合位置。',url:''}));
  // Add POIs for direct map-to-event navigation without claiming a bus drives between them.
  for(const a of activities.filter(a=>a.point))if(!planStops.some(s=>s.eventIds.includes(a.id)))planStops.push({id:a.id+'-point',name:a.name,point:a.point,eventIds:[a.id],note:a.note,url:a.url});
  const legs=[];for(let j=1;j<stops.length;j++)if(stops[j-1].point&&stops[j].point)legs.push({id:id+'-leg'+j,from:planStops[j-1].id,to:planStops[j].id,mode:i===2?'团队交通（车船待确认）':'团队交通',duration:'以领队安排为准',note:'虚线只表示行程先后，不是实际道路或航线，不用于导航。',url:'',checkedDate:''});
  return {id,date:'',stops,mode:[0,8,9].includes(i)?'飞机':'大巴',departure:'',arrival:'',duration:d.date+' · 见当日安排',lodging:[0,8].includes(i)?'飞机上':i===9?'行程结束':'四星级酒店 · 名称与地址待定',lodgingStatus:'pending',status:'pending',note:'团队安排：'+d.plan+'\n自己的时间：'+d.window+'\n待确认：'+d.note,source:'用户提供的 10 月 9 日版意大利 10 天行程单，第 1–4 页；参考安排，未代替最终通知。',road:null,activities,routePlans:[{id:id+'-tour',name:'团队行程 · 参考路线',note:'参考资料中的先后顺序；未知小镇与酒店保留缺口，不虚构道路或集合点。',stops:planStops,legs}]};
});
const optionPoint={castle:'castle',ambrosiana:'ambrosiana','venice-walk':'rialto',ducal:'ducal',florence:'loggia',amalfi:'amalfi',rome:'ignazio'};
const optionStart={7:'milan',6:'venice',8:'dante',3:'amalfi',2:'pantheon'};
for(const o of options){
  const day=state.days[o.day-1],key=optionPoint[o.id],start=optionStart[o.day],eventId='italy-option-'+o.id,source=sources.find(s=>s.id===o.source);
  day.activities.push({id:eventId,name:'自由探索建议 · '+o.title,point:pts[key],time:'仅在领队确认窗口后',duration:'至少 '+o.minutes+' 分钟（含往返）',transport:'步行 · 预算非实测',status:'optional',note:o.why+'\n路线：'+o.route+'\n时间：'+o.budget+'\n条件：'+o.condition,url:source.url,photo:photo(key,o.title),photos:[]});
  const stops=[{id:'start',name:names[start]+'（参考起点）',point:pts[start],eventIds:[],note:'实际集合点待确认。',url:''},{id:'visit',name:o.title,point:pts[key],eventIds:[eventId],note:o.condition,url:source.url},{id:'return',name:'返回参考起点 · 实际集合点待确认',point:pts[start],eventIds:[],note:'必须核实集合位置，按领队通知返团。',url:''}];
  day.routePlans.push({id:'italy-plan-'+o.id,name:'备选 · '+o.title,note:o.condition+'\n'+o.budget,stops,legs:[['start','visit'],['visit','return']].map(([from,to],i)=>({id:'walk-'+i,from,to,mode:'步行 · 示意',duration:'总窗口至少 '+o.minutes+' 分钟',note:o.budget+' 直线仅为位置关系，不是可步行路径；路线与入口须现场核对。',url:source.url,checkedDate:'2026-10-10'}))});
}
const checklist=['确认出行年份、最终版行程、实际机票与出发集合时间。','确认 10.27 米兰自由活动开始 / 结束时刻，以及精确集合位置。','确认 10.26 威尼斯是否允许自由活动，15:30 是船还是大巴出发。','确认 10.28 佛罗伦萨实际抵达时间，能否顺路停留领主广场。','确认海岸船班、阿马尔菲停靠点和自理餐的实际时间范围。','确认 7 晚酒店名称与地址；“意小镇”的实际名称。','核实 10.29 离店和到机场时间，解决 08:00 早餐与提前 4 小时到场的冲突。','取得领队认可的返团方案后，再决定是否预约馆内参观。','保存领队联络方式、集合点和城市离线地图；测试网页断网重开。'];
state.packing=checklist.map((name,i)=>({id:'italy-check-'+i,name,category:'其他物品',done:false}));
const section=(title,body,links=[])=>({title,body,steps:[],phrases:[],images:[],links});
state.guides=options.map(o=>{const s=sources.find(s=>s.id===o.source);return {id:'italy-guide-'+o.id,title:'10.'+(20+o.day)+' · '+o.title,category:'景点预约',summary:o.tags+' · '+o.priority+' · 至少 '+o.minutes+' 分钟 · 未获准离团',body:o.why,url:s.url,checkedDate:'2026-10-10',sections:[section('怎么走与在哪里集合',o.route+'\n地图及照片请在每日行程 D'+o.day+' 对应备选安排中查看。'),section('时间预算与放弃条件',o.budget+'\n'+o.condition),section('官方信息与临行复核',s.note,[{label:s.title,url:s.url}])]};});
state.guides.unshift({id:'italy-guide-before',title:'跟团中留出自己的时间',category:'当地提醒',summary:'米兰有明确自由活动；其他城市先确认窗口，建议与原行程分开。',body:'时间预算 = 领队允许的窗口 − 去程 − 回程 − 入场排队 − 至少 20–30 分钟集合余量。威尼斯另计返船时间。自理餐和时间表空白不等于可以离团。',url:'',checkedDate:'2026-10-10',sections:[section('优先选择',days[6].window+'\n米兰城堡 / 美术馆二选一；威尼斯散步 / 总督府二选一。'),section('这次不硬塞进去的地点','《最后的晚餐》须先核实预约。乌菲兹、学院美术馆、穹顶攀登需要连续时间；圣吉米尼亚诺、蒙特里久尼、卢卡等跨城支线不在团线内。那不勒斯没有明确市区自由活动，酒店也未知。'),section('离线使用','首次联网等待“离线内容已就绪”。意大利照片、全部文字、地理轮廓、景点标记和路线示意均随应用缓存；可缩放地图并打开点位、照片和攻略。离线轮廓没有街道细节，步行导航仍需提前下载地图应用的城市离线包。') ]});
state.guides.push({id:'italy-guide-sources',title:'行程来源、图片授权与待确认事项',category:'其他攻略',summary:'行程来自用户 PDF；图片为景观参考；年份、酒店、集合位置待最终通知。',body:'团队摘要来自《1021 3U意大利一地10天(1009).pdf》第 1–4 页；原件保留本机。所有位置用于景区 / 城市定位，不自动代表团队出入口。照片使用 Wikimedia Commons 授权缩略图，未另作修改；不是本次旅行实拍。底图轮廓来自 Natural Earth 公有领域数据。',url:'https://www.naturalearthdata.com/about/terms-of-use/',checkedDate:'2026-10-10',sections:[...sources.map(s=>section(s.title,s.note,[{label:'官方来源',url:s.url}])),...Object.values(media).map(m=>section(m.title+' · 图片许可',m.credit+' · '+m.license+'；Wikimedia Commons 缩略图，未另作修改。',[{label:'图片来源与作者',url:m.sourceUrl},...(m.licenseUrl?[{label:'授权条款',url:m.licenseUrl}]:[])]))]});
const valid=validateState(state);
await writeFile('public/italy-trip.json',JSON.stringify(valid,null,2)+'\n');
console.log('Italy:',valid.days.length,'days,',valid.days.reduce((n,d)=>n+d.activities.length,0),'events,',valid.guides.length,'guides');
