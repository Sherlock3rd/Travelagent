# Travelagent

用于逐步建设旅游攻略能力的项目。本次旅行将作为首个真实样本，行程资料由用户后续补充。

## 本地使用

已验证 Node.js 22。基础服务无第三方运行依赖。

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

- Git：https://github.com/Sherlock3rd/Travelagent
- Supabase：已识别可用账号，项目选择/创建进行中，最终状态见 `session/session.md`。
- 本地修改可直接刷新预览；提交和推送负责版本同步，二者独立运行。
- 每次推送 main 或提交 PR，GitHub Actions 执行环境检查。
- 当前页面仅供检查环境；旅行内容、数据模型、登录方式和产品界面待后续确认。

更多信息见 [开发说明](docs/development.md)、[项目规则](rules/rules.md)、[会话记录](session/session.md)。
