# 地图语言与操作

- 中文底图使用 OpenFreeMap 的 OpenMapTiles 矢量数据与 Liberty 样式，MapLibre GL JS 6.11.1 通过官方 Leaflet bridge 0.1.4 接入。保留 Leaflet 行程覆盖层与选点流程。
- 优先顺序：name:zh-Hans → name:zh → name:en → name_en → name；空字符串继续回退。原本为道路编号的文字字段不改成地名。
- 中文名称覆盖由上游数据决定，可能出现繁体译名或原文，不能保证每条道路/商店都存在中文名。中文字符使用设备字体绘制。
- 鼠标滚轮、双击、手机双指缩放和拖动均启用；放大/缩小按钮中文命名，42×42 CSS 像素。主地图和编辑选点地图使用同一配置。
- 浏览器不支持矢量渲染或首次加载超过20秒时回退到原有OSM图片底图，提示中文不可用；行程数据不变。
- 仅向地图服务请求底图瓦片、字体及图标；不上传行程JSON、订单、留言或证件信息。地图服务可以看到请求区域，与原底图的请求方式相同。
- MapLibre 使用同源ES模块与模块worker；服务器提供.mjs的JavaScript MIME类型，并仅为底图域增加connect-src。worker限定同源，未启用unsafe-eval或远程脚本。

## 来源与许可

- [OpenFreeMap 接入说明](https://openfreemap.org/quick_start/)
- [服务与许可说明](https://openfreemap.org/)
- [官方 Leaflet bridge](https://github.com/maplibre/maplibre-gl-leaflet)
- 本地map-style-zh.json改编自OpenFreeMap Liberty；修改文字语言优先级及字间距。来源样式2026-09-24获取。
- 样式许可见public/map-style-LICENSE.md与public/map-style-upstream-LICENSE.md；库许可与分发文件一同保存在public/vendor/maplibre/。

## 验证

- 中文底图浏览器实测显示中文国家与地名；实际滚轮放大可看到更细道路。
- 390×844视口下点击缩放按钮成功，无整页横向溢出；双指选项启用，但工具不支持实际双指手势，真机手势体验尚未验证。
- 原有用户清单勾选与行程数据保留，不导入、不覆盖localStorage。
