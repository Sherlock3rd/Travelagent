# 地图依赖与使用范围

核验日期：2026-09-24。

- [Leaflet 下载与版本](https://leafletjs.com/download.html)：使用稳定版 1.9.4，package-lock.json 锁定；public/vendor/leaflet 来自对应 npm 包 dist/，LICENSE 随包保留。
- [OpenStreetMap 图块政策](https://operations.osmfoundation.org/policies/tiles/)：浏览器直接请求 HTTPS 图块，保留可见署名与 Referer，使用浏览器缓存，不预取或提供离线瓦片下载。
- [OSRM Route API](https://project-osrm.org/docs/v5.24.0/api/)：仅用户点击后计算 driving 路线，标为估算，不当作实际班次或预订。
- [OSRM API 使用政策](https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy)：公共演示服务不保证可用性；应用限制单次请求并提供超时和失败提示。

附图仅作为视觉参考，本仓库不复制该图，也未提取其中的意大利行程数据。

底图是在线资源。网络异常只影响地图，不应导致其他模块无法使用。跨设备/大规模公开上线前重新评估地图服务供应方案。
