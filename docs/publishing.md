# 网站发布

站点：https://sherlock3rd.github.io/Travelagent/

GitHub Pages 使用 Actions 发布 `dist/`，源文件只来自 `public/`；`private/`、环境变量、本地浏览器资料不会自动上传。用户于 2026-09-24 明确授权当前旅行内容公开，最新页面导出快照以 `public/published-trip.json` 随应用发布。每次推送 main 先执行语法检查与测试，再构建和部署，失败不会替换已发布页面。构建清空旧产物并在 release.json 中记录提交号。

完整页面包含地图、每日行程、清单、留言和攻略，无需口令或登录。当前已接入 Supabase，共享工作区是权威来源；发布快照只作首次缓存兜底，启动后以服务器内容为准。保存服务器内容不需要重新发布网页，各设备在页面可见时自动刷新。

线上与 localhost 使用同一服务器工作区。本机旧资料有差异时先保留备份；编辑失败保留草稿，不盲目覆盖云端。使用方式与访问范围见 [云同步说明](cloud-sync.md)。

入口、样式和应用模块使用提交号作为资源版本，避免老标签页复用旧脚本。地图 bridge 含本地生命周期保护：小地图移出视口被移除后，已排队的 resize / moveend 回调直接返回，升级依赖时保留或检查上游是否已修复。

来源：[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
