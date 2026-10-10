import { days, options, sources } from './italy-data.js';
const $ = s => document.querySelector(s);
const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const source = id => sources.find(s=>s.id===id);
const checklist = [
  '确认出行年份、最终版行程、实际机票与出发集合时间。',
  '确认 10.27 米兰自由活动开始 / 结束时刻，以及精确集合位置。',
  '确认 10.26 威尼斯是否允许自由活动，15:30 是船还是大巴出发。',
  '确认 10.28 佛罗伦萨实际抵达时间，能否顺路停留领主广场。',
  '确认海岸船班、阿马尔菲停靠点和自理餐的实际时间范围。',
  '确认 7 晚酒店名称与地址；“意小镇”的实际名称。',
  '核实 10.29 离店和到机场时间，解决 08:00 早餐与提前 4 小时到场的冲突。',
  '取得领队认可的返团方案后，再决定是否预约馆内参观。',
  '保存领队联络方式、集合点和城市离线地图；测试网页断网重开。'
];
$('#route-chain').innerHTML = days.map(d=>`<a href="#day-${d.id}"><span>${d.date}</span><strong>${esc(d.title)}</strong><span aria-hidden="true">↗</span></a>`).join('');
$('#italy-days').innerHTML = days.map(d=>`<article class="italy-day" id="day-${d.id}" tabindex="-1"><div class="day-date"><strong>${d.date}</strong><span>DAY ${String(d.id).padStart(2,'0')}</span></div><div class="day-body"><div class="day-title"><h3>${esc(d.title)}</h3><span class="pill ${d.id===7?'':d.level==='需领队确认'?'warm':'neutral'}">${d.level}</span></div><div class="day-columns"><div><h4>团队安排 · 原行程</h4><p>${esc(d.plan)}</p></div><div><h4>自己的时间 · 建议</h4><p>${esc(d.window)}</p>${options.some(o=>o.day===d.id)?`<a class="text-button" href="#explore-${d.id}">查看当天探索建议 ↗</a>`:''}</div></div><details><summary>交通、住宿与待确认事项</summary><p>${esc(d.note)}</p></details></div></article>`).join('');
function renderOptions() {
  const chosen=options.filter(o=>$('#city-filter').value==='all'||String(o.day)===$('#city-filter').value);
  $('#options-count').textContent=`${chosen.length} 条建议 · 所需时间含往返与集合余量`;
  $('#italy-options').innerHTML=chosen.map(o=>`<article class="option-card" id="option-${o.id}"><div class="card-meta"><span class="pill ${o.day===7?'':'warm'}">${esc(o.priority)}</span><span>${days[o.day-1].date} · 至少 ${o.minutes} 分钟</span></div><h3>${esc(o.title)}</h3><p class="latin">${esc(o.latin)}</p><p class="option-tags">${esc(o.tags)}</p><p>${esc(o.why)}</p><details><summary>怎么走、留多久、什么时候放弃</summary><h4>建议路线</h4><p>${esc(o.route)}</p><h4>时间预算 · 非实测</h4><p>${esc(o.budget)}</p><h4>决定前先确认</h4><p>${esc(o.condition)}</p><div class="option-links"><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.latin+' Italy')}" target="_blank" rel="noopener noreferrer">在地图中搜索 ↗（需联网）</a><a href="${source(o.source).url}" target="_blank" rel="noopener noreferrer">官方资料 ↗</a><a href="#day-${o.day}">返回当天安排 ↗</a></div></details></article>`).join('');
}
$('#city-filter').addEventListener('change',renderOptions);renderOptions();
$('#italy-sources').innerHTML=sources.map(s=>`<article class="paper-card"><a href="${s.url}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a><p>${esc(s.note)}</p><span class="subtle">核验于 2026-10-10 · 外链需要联网</span></article>`).join('');
const key='travelagent.italy.checklist.v1';
let checked={};let storageOK=true;
try {const saved=JSON.parse(localStorage.getItem(key)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))checked=saved;}catch{storageOK=false;}
$('#italy-checklist').innerHTML=checklist.map((label,i)=>`<label class="italy-check"><input type="checkbox" data-check="${i}" ${checked[i]===true?'checked':''}><span>${esc(label)}</span></label>`).join('');
$('#checklist-status').textContent=storageOK?'仅保存本机勾选；待确认项不会自动变成已确认行程。':'本机存储不可用，勾选可能无法保留。';
$('#italy-checklist').addEventListener('change',e=>{
  if(!e.target.matches('[data-check]'))return;
  checked[e.target.dataset.check]=e.target.checked;
  try{localStorage.setItem(key,JSON.stringify(checked));$('#checklist-status').textContent='已保存在当前浏览器 · 离线也可勾选';}catch{$('#checklist-status').textContent='本机保存失败；请保留页面或手动记录，刷新后可能丢失。';}
});
function route() {
  const hash=location.hash.slice(1)||'overview';
  const day=/^day-(\d+)$/.exec(hash), explore=/^explore-(\d+)$/.exec(hash);
  const active=day?'days':explore?'explore':['overview','days','explore','prepare','sources'].includes(hash)?hash:'overview';
  document.querySelectorAll('.travel-panel').forEach(p=>p.hidden=p.id!==active);
  document.querySelectorAll('.travel-tabs a').forEach(a=>{if(a.hash==='#'+active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  if(explore){$('#city-filter').value=explore[1];renderOptions();}
  if(day){const el=document.getElementById(hash);el?.scrollIntoView({block:'start',behavior:'instant'});el?.focus({preventScroll:true});}
  else if(location.hash){document.getElementById(active)?.scrollIntoView({block:'start',behavior:'instant'});}
}
window.addEventListener('hashchange',route);route();
