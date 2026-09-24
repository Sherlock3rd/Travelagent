// Rich guides remain structured text: imported HTML is never executed.
export const GUIDE_IMAGE_HOSTS = ['dohahamadairport.com', 'betamedia.experienceegypt.eg'];
export function parseGuideDetails(g, { safeURL }) {
  const text = (v = '', max = 6000) => { if (typeof v !== 'string' || v.length > max) throw Error('攻略文字格式或长度无效。'); return v.trim(); };
  const list = (v = [], max = 24) => { if (!Array.isArray(v) || v.length > max) throw Error('攻略分节数量超出限制。'); return v; };
  const sections = list(g.sections).map(s => ({
    title: text(s.title, 160), body: text(s.body),
    steps: list(s.steps).map(x => ({ title: text(x.title, 160), body: text(x.body) })),
    phrases: list(s.phrases, 12).map(x => ({ en: text(x.en, 1500), zh: text(x.zh, 1500) })),
    images: list(s.images, 4).map(x => {
      const url = safeURL(text(x.url, 2000)), parsed = new URL(url);
      if (parsed.protocol !== 'https:' || !GUIDE_IMAGE_HOSTS.includes(parsed.hostname) || parsed.port) throw Error('攻略图片须使用已支持的官方 HTTPS 图片来源。');
      return { url, alt: text(x.alt, 240), caption: text(x.caption, 600), sourceUrl: safeURL(text(x.sourceUrl, 2000)) };
    }),
    links: list(s.links, 12).map(x => ({ label: text(x.label, 160), url: safeURL(text(x.url, 2000)) }))
  }));
  return { summary: text(g.summary, 500), sections };
}
export function guideHTML(g, esc, open = false) {
  const link = (url, label) => '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + ' ↗</a>';
  return '<details class="panel guide-card" id="guide-' + g.id + '"' + (open ? ' open' : '') + '><summary><span class="guide-category">' + esc(g.category) + '</span><h3>' + esc(g.title) + '</h3><p class="guide-summary">' + esc(g.summary || g.body.slice(0, 110) + (g.body.length > 110 ? '…' : '')) + '</p><span class="guide-toggle"><span class="when-closed">展开' + (g.sections.length ? ' · ' + g.sections.length + ' 个章节' : '全文') + ' ↓</span><span class="when-open">收起 ↑</span></span></summary><div class="guide-content"><div class="guide-top"><span>核验日期：' + esc(g.checkedDate || '尚未核验') + '</span><div><button class="text-button" data-edit-guide="' + g.id + '">编辑</button> <button class="icon-button" data-delete-guide="' + g.id + '" aria-label="删除攻略">×</button></div></div><p class="guide-body">' + esc(g.body) + '</p>' +
    (g.sections.length ? '<nav class="guide-toc" aria-label="攻略章节">' + g.sections.map((s,i) => '<a href="#guide-' + g.id + '-s' + i + '">' + (i+1) + '. ' + esc(s.title) + '</a>').join('') + '</nav>' : '') +
    g.sections.map((s,i) => '<section class="guide-section" id="guide-' + g.id + '-s' + i + '"><h4><span>' + String(i+1).padStart(2,'0') + '</span>' + esc(s.title) + '</h4>' + (s.body ? '<p class="guide-body">' + esc(s.body) + '</p>' : '') +
      (s.steps.length ? '<ol class="guide-steps">' + s.steps.map(x => '<li><strong>' + esc(x.title) + '</strong><p>' + esc(x.body) + '</p></li>').join('') + '</ol>' : '') +
      s.phrases.map((x,j) => '<div class="guide-phrase"><p lang="en">' + esc(x.en) + '</p><p>' + esc(x.zh) + '</p><button class="text-button" data-copy-phrase="' + g.id + '" data-section="' + i + '" data-phrase="' + j + '">复制英文</button></div>').join('') +
      s.images.map(x => '<figure class="guide-figure"><a href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer"><img loading="lazy" referrerpolicy="no-referrer" src="' + esc(x.url) + '" alt="' + esc(x.alt) + '"></a><figcaption>' + esc(x.caption) + ' ' + link(x.sourceUrl || x.url, '图片来源 / 查看原图') + '<span class="image-fallback" hidden>图片暂不可用，可打开来源查看；步骤文字不受影响。</span></figcaption></figure>').join('') +
      (s.links.length ? '<div class="guide-links">' + s.links.map(x => link(x.url,x.label)).join('') + '</div>' : '') + '</section>').join('') +
    '<div class="guide-source">' + (g.url ? link(g.url,'主要信息来源') : '<span>来源待补充</span>') + '<a href="#guide-' + g.id + '">返回本篇顶部 ↑</a><button class="text-button" data-collapse-guide="' + g.id + '">收起本篇 ↑</button></div></div></details>';
}
