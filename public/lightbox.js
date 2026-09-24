// One in-page viewer for itinerary and guide images. Source links remain separate.
export function photoButton(photo, esc, extra = '') {
  return '<button type="button" class="scenery-image" data-lightbox data-image="'+esc(photo.url)+'" data-title="'+esc(photo.title || photo.alt)+'" data-caption="'+esc(photo.caption || '')+'" data-source="'+esc(photo.sourceUrl || '')+'" data-credit="'+esc(photo.credit || '图片来源')+'" aria-label="放大查看：'+esc(photo.title || photo.alt)+'" '+extra+'><img src="'+esc(photo.url)+'" alt="'+esc(photo.title || photo.alt)+'" loading="lazy" referrerpolicy="no-referrer"><span aria-hidden="true">⤢</span></button>';
}
export function mountLightbox() {
  const dialog=document.createElement('dialog');
  dialog.className='photo-viewer'; dialog.setAttribute('aria-labelledby','photo-viewer-title');
  dialog.innerHTML='<div class="viewer-toolbar"><span class="viewer-count" aria-live="polite"></span><button type="button" class="viewer-close" aria-label="关闭大图">×</button></div><div class="viewer-stage"><button type="button" class="viewer-prev" aria-label="上一张">‹</button><img referrerpolicy="no-referrer" alt=""><p class="viewer-error" role="status" hidden>图片暂时无法加载，请稍后重试。</p><button type="button" class="viewer-next" aria-label="下一张">›</button></div><div class="viewer-caption"><h2 id="photo-viewer-title"></h2><p></p><a target="_blank" rel="noopener noreferrer"></a></div>';
  document.body.append(dialog);
  const image=dialog.querySelector('img'), prev=dialog.querySelector('.viewer-prev'), next=dialog.querySelector('.viewer-next'), error=dialog.querySelector('.viewer-error');
  let entries=[],index=0,opener,overflow;
  function paint() {
    const data=entries[index].dataset;
    error.hidden=true; image.hidden=false; image.alt=data.title; image.src=data.image;
    dialog.querySelector('h2').textContent=data.title;
    dialog.querySelector('.viewer-caption p').textContent=data.caption;
    const source=dialog.querySelector('.viewer-caption a'); source.textContent=data.credit+' ↗';source.hidden=!data.source;if(data.source)source.href=data.source;
    dialog.querySelector('.viewer-count').textContent=(index+1)+' / '+entries.length;
    prev.hidden=next.hidden=entries.length<2;
  }
  const step=offset=>{index=(index+offset+entries.length)%entries.length;paint();};
  image.onerror=()=>{image.hidden=true;error.hidden=false;};
  prev.onclick=()=>step(-1);next.onclick=()=>step(1);
  dialog.querySelector('.viewer-close').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();step(e.key==='ArrowLeft'?-1:1);}});
  dialog.addEventListener('close',()=>{document.body.style.overflow=overflow;opener?.focus({preventScroll:true});image.removeAttribute('src');entries=[];});
  document.addEventListener('click',e=>{
    const button=e.target.closest('[data-lightbox]');if(!button)return;
    e.preventDefault();opener=button;
    entries=[...(button.closest('[data-photo-gallery]') || button.parentElement).querySelectorAll('[data-lightbox]')];index=entries.indexOf(button);
    overflow=document.body.style.overflow;document.body.style.overflow='hidden';paint();dialog.showModal();dialog.querySelector('.viewer-close').focus();
  });
}
