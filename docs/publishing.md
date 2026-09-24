# 网站发布

站点：https://sherlock3rd.github.io/Travelagent/

GitHub Pages 使用 Actions 发布 `dist/`，源文件只来自 `public/`；`private/`、环境变量、本地浏览器资料不会自动上传。每次推送 main 先执行语法检查与测试，再构建和部署，失败不会替换已发布页面。构建清空旧产物并在 release.json 中记录提交号。

完整工具包含地图、每日行程、清单、留言和攻略。线上与 localhost 属于不同来源，浏览器资料独立；当前应用尚无业务云同步，不能把前端发布视为多人同步或自动迁移。真实资料的发布方式须单独确认。

来源：[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
