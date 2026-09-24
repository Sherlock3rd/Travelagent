# Supabase 环境

2026-09-24 经用户确认创建 Travelagent 独立项目。

| 项目 | 当前值 |
| --- | --- |
| 组织 | Sherlock3rd's Org |
| 项目名 | Travelagent |
| 项目 ref | xqardnobmoaxosjqwiwh |
| 区域 | ap-southeast-1（新加坡） |
| API 地址 | https://xqardnobmoaxosjqwiwh.supabase.co |
| 控制台 | https://supabase.com/dashboard/project/xqardnobmoaxosjqwiwh |
| 创建时报价 | Free / 0 USD 每月；不代表未来超额用量或套餐变更的承诺 |

## 已验证

- 项目 ACTIVE_HEALTHY。
- 数据库 SELECT 查询成功。
- npm run check:cloud 使用本机 .env 的 publishable key 访问 Auth settings，HTTP 200。
- 创建后 security advisors 无告警，public schema 无业务表。
- .env 被 Git 忽略，没有把 service_role/secret key 放入代码或浏览器。

## 共享旅行已接入

当前已部署 travel_workspaces、travel_revisions 与 travel-sync Edge Function。全部旅行内容保存在服务器，各设备自动读取与保存。用户选择暂不登录验证，因此为公开共同编辑工作区。两表启用 RLS，直接匿名访问被拒绝，固定工作区通过函数入口操作；历史、版本冲突与未保存草稿保护详见 [云同步说明](cloud-sync.md)。

未实现账户登录、成员权限和离线自动上传；当前断网只读缓存，不误报保存成功。
