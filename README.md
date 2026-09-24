# Travelagent

用于逐步建设旅游攻略能力的项目。本次旅行将作为首个真实样本，行程资料由用户后续补充。

## 本地使用

已验证 Node.js 22。服务使用 Node.js 原生模块；地图使用固定版本 Leaflet 1.9.4，随应用提供。

```powershell
cd D:\charlie\Travelagent
npm.cmd ci
npm.cmd start
```

访问 http://127.0.0.1:8788 。前台运行用 Ctrl+C 停止。

Windows 后台运行、查看与停止：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev.ps1 Start
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev.ps1 Status
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev.ps1 Stop
```

后台服务与当前命令窗口独立，电脑重启后需重新启动。端口占用时可在 Start 后加 `-Port 8789`，不会终止其他项目。

## 版本与云端

- 公网工具：https://sherlock3rd.github.io/Travelagent/ ，推送 main 自动检查、构建并发布；详见 [发布说明](docs/publishing.md)。
- Git：https://github.com/Sherlock3rd/Travelagent
- Supabase：免费独立 Travelagent 项目已创建，数据库/API 验证通过，详见 [云端环境](docs/supabase.md)。
- 本地修改可直接刷新预览；提交和推送负责版本同步，二者独立运行。
- 每次推送 main 或提交 PR，GitHub Actions 执行环境检查。
- 当前页面包含地图、每日行程、物品准备、备注留言和附加攻略，详见 [五模块范围](spec/travel-workspace-v1.md)。
- 内容保存在当前浏览器，可导出/导入 JSON 备份。Supabase 尚未接入业务同步，没有多人留言或跨设备同步。
- 实际旅行资料待用户提供，参考图只参考样式。

更多信息见 [开发说明](docs/development.md)、[项目规则](rules/rules.md)、[会话记录](session/session.md)。
