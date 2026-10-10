const statusNodes=()=>document.querySelectorAll('[data-offline-status]');
let registration, ready=false, updateRequested=false;
function status(message){statusNodes().forEach(el=>el.textContent=message);}
function showReady(){status(ready?(navigator.onLine?'离线内容已就绪 · 主页与全部意大利页签可断网打开':'当前离线 · 已保存的主页与全部意大利页签可阅读'):'离线内容尚未完整保存，请联网后点击检查重试。');}
function updateButton(){document.querySelectorAll('[data-offline-update]').forEach(el=>el.hidden=!registration?.waiting);}
async function verify(){
  const worker=navigator.serviceWorker.controller||registration?.active;
  if(!worker){status('正在下载离线内容，请保持联网…');return;}
  try{
    const result=await new Promise((resolve,reject)=>{
      const channel=new MessageChannel();
      const timer=setTimeout(()=>{channel.port1.close();reject(new Error('timeout'));},6000);
      channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};
      worker.postMessage({type:'OFFLINE_STATUS'},[channel.port2]);
    });
    ready=result.ready===true;showReady();
  }catch{ready=false;status(registration?.waiting?'新版离线内容已下载，请点击“更新页面”启用。':'无法确认离线缓存是否完整，请联网后重试。');}
  updateButton();
}
async function start(){
  if(!('serviceWorker' in navigator)||!window.isSecureContext){status('此浏览器或地址不支持离线保存，请使用 HTTPS 网站或本机 localhost。');return;}
  try{
    // Looking up an existing worker first also works while offline.
    registration=await navigator.serviceWorker.getRegistration(new URL('./',import.meta.url));
    if(registration?.active)await verify();
    if(navigator.onLine||!registration)registration=await navigator.serviceWorker.register(new URL('./sw.js',import.meta.url),{scope:new URL('./',import.meta.url).pathname,updateViaCache:'none'});
    updateButton();
    const watch=worker=>{if(!worker)return;worker.addEventListener('statechange',()=>{
      if(worker.state==='activated')verify();
      if(worker.state==='installed')updateButton();
      if(worker.state==='redundant'&&!ready)status('离线下载未完成；请保持联网后点击检查重试。');
    });};
    watch(registration?.installing);
    registration?.addEventListener('updatefound',()=>watch(registration.installing));
    await verify();
  }catch{if(ready)showReady();else status('离线下载未完成；请保持联网后点击检查重试。');}
}
if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(updateRequested)location.reload();else verify();
});
window.addEventListener('offline',showReady);
window.addEventListener('online',start);
document.querySelectorAll('[data-offline-retry]').forEach(el=>el.addEventListener('click',async()=>{
  el.disabled=true;
  try{await start();if(navigator.onLine)await registration?.update();await verify();}catch{showReady();}finally{el.disabled=false;}
}));
document.querySelectorAll('[data-offline-update]').forEach(el=>el.addEventListener('click',()=>{
  if(!registration?.waiting)return;
  if(document.querySelector('dialog[open]')){status('请先保存或关闭编辑窗口，再更新页面。');return;}
  if([...document.querySelectorAll('#packing-name,#note-body,#note-author')].some(el=>el.value.trim())){status('请先保存正在输入的清单或留言，再更新页面。');return;}
  updateRequested=true;registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
}));
start();
