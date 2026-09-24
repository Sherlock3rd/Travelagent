# 网站发布

站点：https://sherlock3rd.github.io/Travelagent/

GitHub Pages 使用 Actions 发布 `dist/`，源文件只来自 `public/`；`private/`、环境变量、本地浏览器资料不会自动上传。用户于 2026-09-24 明确授权当前旅行内容公开，最新页面导出快照以 `public/published-trip.json` 随应用发布。每次推送 main 先执行语法检查与测试，再构建和部署，失败不会替换已发布页面。构建清空旧产物并在 release.json 中记录提交号。

完整页面包含地图、每日行程、清单、留言和攻略，无需口令或登录。新浏览器首次打开自动载入发布快照；已有本机资料（含主动清空的行程）始终优先，加载过程中其他标签页保存的内容也不会被覆盖。没有默认文件时为空白工具，下载或校验失败不会保存空白替代资料。

线上与 localhost 属于不同来源，浏览器资料独立；当前应用尚无业务云同步，编辑仅保存当前浏览器，不会自动修改所有访客看到的发布版。后续内容更新需重新导出最新快照、核对后发布。页面提供 JSON 导入/导出；发布快照为公开数据，不是访问控制。

来源：[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
