# 开发环境说明

## 目录职责

| 目录 | 用途 |
| --- | --- |
| public/ | HTTP 站点文件；只将允许公开的内容放在这里 |
| scripts/ | 本地服务与环境维护脚本 |
| test/ | 服务访问边界验证 |
| private/ | 本机旅行原始资料，Git 忽略 |
| .runtime/ | 进程状态与日志，Git 忽略 |
| rules/、spec/ | 执行规则与基础规范快照 |
| session/requirements/ | 每项需求的确认、变更与状态 |
| mistakes/ | 错误复盘和防呆 |
| docs/ | 开发与运行说明 |

## Git 与服务并行

1. 保持本地服务运行，在当前工作目录修改文件。
2. 刷新 http://127.0.0.1:8788 检查结果；服务禁用缓存。
3. 执行 `npm.cmd run check`、`npm.cmd test`、`git diff --check`。
4. 检查 `git status` 与 `git diff`，仅提交本次确认范围。
5. `git add <文件>` → `git commit` → `git push origin main`。
6. 推送后检查 GitHub Actions，核对本地与远程提交号。

如果 PATH 中的 Git 是老版本 Cygwin，可在本机使用已验证的 Windows Git：

```powershell
& 'C:\Users\liuweichen\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe' status
```

此路径是本机工具位置，换设备时使用该设备安装的 Git。

## 服务核验

`scripts/dev.ps1 Status` 同时校验 PID、Node 进程脚本路径与 `/healthz`，避免误把其他项目当作当前服务。日志位于 `.runtime/server.log` 和 `.runtime/server.error.log`。

服务器只读取 `public/`。访问 `/.git/config`、`/private/`、`/rules/rules.md` 应返回 404。默认只绑定本机，未配置开机自启。

## 后续旅行样本

目的地、日期、出发地、同行人员数量及偏好由用户后续补充。收到资料后先整理需求，再确认攻略内容结构和交互；当前没有创建旅行数据表或虚构示例行程。
